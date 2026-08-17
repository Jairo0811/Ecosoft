from fastapi import FastAPI, HTTPException

from .providers import extract_text, review_anomalies, summarize
from .schemas import AnalysisResponse, AnalyzeRequest, OCRRequest


app = FastAPI(title="EcoSoft AI Service", version="1.0.0")


@app.get("/health")
def health() -> dict[str, str]:
    return {"status": "ok"}


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
