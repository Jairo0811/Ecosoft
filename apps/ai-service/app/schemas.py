from typing import Any, Literal

from pydantic import BaseModel, Field


class AnalyzeRequest(BaseModel):
    text: str = Field(min_length=1, max_length=500_000)
    operation: Literal["SUMMARY", "ANOMALY_REVIEW"]


class OCRRequest(BaseModel):
    content_base64: str = Field(min_length=1, max_length=7_100_000)
    mime_type: str = Field(min_length=1, max_length=120)


class AnalysisResponse(BaseModel):
    provider: str
    result: dict[str, Any]
    source_references: list[str]
    confidence: float = Field(ge=0, le=1)
