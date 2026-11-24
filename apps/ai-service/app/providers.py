import base64
import binascii
import re
from collections import Counter

from .schemas import AnalysisResponse


PROVIDER = "LOCAL_DETERMINISTIC"

# The API accepts at most 100 source references per result; larger documents are capped
# explicitly (and flagged) instead of failing validation downstream.
MAX_SIGNALS = 100

# Formats the local provider can read. It decodes UTF-8 text; it does NOT perform OCR on
# images or scanned PDFs and does not parse PDF/DOCX/XLSX containers.
TEXT_MIME_TYPES = frozenset({"text/plain", "text/csv", "application/json", "text/markdown"})

CAPABILITIES: dict[str, object] = {
    "provider": PROVIDER,
    "processing": "deterministic",
    "generative_ai": False,
    "ocr": False,
    "operations": {
        "SUMMARY": "Resumen extractivo: primeras oraciones del texto, sin generación.",
        "ANOMALY_REVIEW": "Señales heurísticas por palabras clave y montos repetidos.",
        "TEXT_EXTRACTION": "Decodificación de texto UTF-8 de archivos textuales.",
    },
    "text_extraction_mime_types": sorted(TEXT_MIME_TYPES),
    "unsupported": [
        "OCR de imágenes (PNG/JPEG)",
        "PDF escaneados o PDF con texto",
        "DOCX/XLSX",
    ],
    "human_review_required": True,
}


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
    total_signals = len(signals)
    signals = signals[:MAX_SIGNALS]
    return AnalysisResponse(
        provider=PROVIDER,
        result={
            "signals": signals,
            "total_signals": total_signals,
            "truncated": total_signals > MAX_SIGNALS,
            "repeated_amounts": repeated[:MAX_SIGNALS],
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
    if mime_type not in TEXT_MIME_TYPES:
        raise ValueError(
            "El proveedor local solo extrae texto de archivos textuales; no realiza OCR de "
            "imágenes ni de PDF escaneados."
        )
    try:
        text = content.decode("utf-8-sig").strip()
    except UnicodeDecodeError as error:
        raise ValueError("El archivo no contiene texto UTF-8 válido.") from error
    if not text:
        raise ValueError("No se encontró texto verificable.")
    return AnalysisResponse(
        provider=PROVIDER,
        result={
            "text": text,
            "language": "und",
            "pages": 1,
            "method": "UTF8_TEXT_DECODE",
            "notice": "Extracción de texto UTF-8; no es OCR.",
        },
        source_references=["document:1"],
        confidence=1.0,
    )
