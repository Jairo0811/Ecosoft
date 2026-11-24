from fastapi import FastAPI, HTTPException

from .providers import CAPABILITIES, extract_text, review_anomalies, summarize
from .schemas import AnalysisResponse, AnalyzeRequest, OCRRequest


# Internal service: only the EcoSoft API calls it (no authentication of its own), so the
# interactive docs are disabled and docker-compose publishes it on loopback only.
app = FastAPI(title="EcoSoft AI Service", version="1.1.0", docs_url=None, redoc_url=None, openapi_url=None)


@app.get("/health")
def health() -> dict[str, str]:
    return {"status": "ok"}


@app.get("/v1/capabilities")
def capabilities() -> dict[str, object]:
    """What the configured provider really does, so clients never promise OCR or generation."""
    return CAPABILITIES


@app.post("/v1/analyze", response_model=AnalysisResponse)
def analyze(payload: AnalyzeRequest) -> AnalysisResponse:
    if payload.operation == "SUMMARY":
        return summarize(payload.text)
    return review_anomalies(payload.text)


@app.post("/v1/ocr", response_model=AnalysisResponse)
def ocr(payload: OCRRequest) -> AnalysisResponse:
    try:
        return extract_text(payload.content_base64, payload.mime_type)
    except ValueError as error:
        raise HTTPException(status_code=422, detail=str(error)) from error
