import base64
import unittest

from fastapi.testclient import TestClient

from app.main import app
from app.providers import MAX_SIGNALS


class ApiTests(unittest.TestCase):
    def setUp(self) -> None:
        self.client = TestClient(app)

    def test_health(self) -> None:
        self.assertEqual(self.client.get("/health").json(), {"status": "ok"})

    def test_capabilities_are_honest(self) -> None:
        body = self.client.get("/v1/capabilities").json()
        self.assertEqual(body["provider"], "LOCAL_DETERMINISTIC")
        self.assertFalse(body["ocr"])
        self.assertFalse(body["generative_ai"])
        self.assertTrue(body["human_review_required"])

    def test_interactive_docs_are_not_exposed(self) -> None:
        for path in ("/docs", "/redoc", "/openapi.json"):
            self.assertEqual(self.client.get(path).status_code, 404)

    def test_analyze_validates_operation_and_size(self) -> None:
        self.assertEqual(
            self.client.post("/v1/analyze", json={"text": "x", "operation": "GENERATE"}).status_code,
            422,
        )
        self.assertEqual(
            self.client.post("/v1/analyze", json={"text": "", "operation": "SUMMARY"}).status_code,
            422,
        )
        too_long = "a" * 500_001
        self.assertEqual(
            self.client.post("/v1/analyze", json={"text": too_long, "operation": "SUMMARY"}).status_code,
            422,
        )

    def test_anomaly_signals_are_capped_and_flagged(self) -> None:
        text = " ".join(f"Garantía {index} pendiente." for index in range(MAX_SIGNALS + 20))
        body = self.client.post("/v1/analyze", json={"text": text, "operation": "ANOMALY_REVIEW"}).json()
        self.assertEqual(len(body["result"]["signals"]), MAX_SIGNALS)
        self.assertLessEqual(len(body["source_references"]), 100)
        self.assertTrue(body["result"]["truncated"])
        self.assertEqual(body["result"]["total_signals"], MAX_SIGNALS + 20)

    def test_text_extraction_is_not_ocr(self) -> None:
        png = base64.b64encode(b"\x89PNG\r\n\x1a\n").decode()
        response = self.client.post("/v1/ocr", json={"content_base64": png, "mime_type": "image/png"})
        self.assertEqual(response.status_code, 422)
        self.assertIn("no realiza OCR", response.json()["detail"])
        text = base64.b64encode("Contrato PPA — energía".encode()).decode()
        body = self.client.post("/v1/ocr", json={"content_base64": text, "mime_type": "text/plain"}).json()
        self.assertEqual(body["result"]["method"], "UTF8_TEXT_DECODE")

    def test_rejects_invalid_base64(self) -> None:
        response = self.client.post("/v1/ocr", json={"content_base64": "%%%", "mime_type": "text/plain"})
        self.assertEqual(response.status_code, 422)


if __name__ == "__main__":
    unittest.main()
