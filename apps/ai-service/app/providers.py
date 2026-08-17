import base64
import binascii
import re
from collections import Counter

from .schemas import AnalysisResponse


PROVIDER = "LOCAL_DETERMINISTIC"


def _sentences(text: str) -> list[str]:
    return [item.strip() for item in re.split(r"(?<=[.!?])\s+|[\r\n]+", text) if item.strip()]


def summarize(text: str) -> AnalysisResponse:
    sentences = _sentences(text)
    selected = sentences[:5]
    return AnalysisResponse(
        provider=PROVIDER,
        result={
            "summary": " ".join(selected),
            "facts": selected,
            "inferences": [],
            "notice": "Resumen extractivo; requiere revisión humana.",
        },
        source_references=[f"sentence:{index + 1}" for index in range(len(selected))],
        confidence=0.75 if selected else 0.0,
    )


def review_anomalies(text: str) -> AnalysisResponse:
    sentences = _sentences(text)
    amounts = re.findall(r"(?:USD|DOP|US\$|RD\$)?\s*\d+(?:[.,]\d+)*", text, flags=re.IGNORECASE)
    repeated = [value for value, count in Counter(amounts).items() if count > 1]
    signals: list[dict[str, object]] = []
    for index, sentence in enumerate(sentences):
        if re.search(r"\b(?:inconsistente|pendiente|faltante|error|excede|incumpl)\w*\b", sentence, re.IGNORECASE):
            signals.append({"source": f"sentence:{index + 1}", "text": sentence})
    return AnalysisResponse(
        provider=PROVIDER,
        result={
            "signals": signals,
            "repeated_amounts": repeated,
            "inferences": [],
            "notice": "Señales heurísticas; no constituyen una decisión regulatoria.",
        },
        source_references=[item["source"] for item in signals],
        confidence=0.65 if signals else 0.4,
    )


def extract_text(content_base64: str, mime_type: str) -> AnalysisResponse:
    try:
        content = base64.b64decode(content_base64, validate=True)
    except (ValueError, binascii.Error) as error:
        raise ValueError("Contenido base64 inválido.") from error
    if not content:
        raise ValueError("El documento está vacío.")
    if mime_type not in {"text/plain", "text/csv", "application/json", "text/markdown"}:
        raise ValueError("El proveedor local solo extrae texto de archivos textuales.")
    try:
        text = content.decode("utf-8-sig").strip()
    except UnicodeDecodeError as error:
        raise ValueError("El archivo no contiene texto UTF-8 válido.") from error
    if not text:
        raise ValueError("No se encontró texto verificable.")
    return AnalysisResponse(
        provider=PROVIDER,
        result={"text": text, "language": "und", "pages": 1},
        source_references=["document:1"],
        confidence=1.0,
    )
