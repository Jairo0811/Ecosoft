import base64
import unittest

from app.providers import extract_text, review_anomalies, summarize


class ProviderTests(unittest.TestCase):
    def test_summary_keeps_verifiable_sentences(self) -> None:
        result = summarize("Capacidad 20 MW. Precio 80 USD. Vigencia diez años.")
        self.assertEqual(result.provider, "LOCAL_DETERMINISTIC")
        self.assertEqual(len(result.result["facts"]), 3)
        self.assertEqual(result.source_references, ["sentence:1", "sentence:2", "sentence:3"])

    def test_anomaly_review_marks_source(self) -> None:
        result = review_anomalies("La garantía está pendiente. El precio es 80 USD.")
        self.assertEqual(result.result["signals"][0]["source"], "sentence:1")

    def test_local_ocr_extracts_utf8_text(self) -> None:
        encoded = base64.b64encode("Contrato PPA".encode()).decode()
        result = extract_text(encoded, "text/plain")
        self.assertEqual(result.result["text"], "Contrato PPA")
        self.assertEqual(result.confidence, 1.0)

    def test_local_ocr_rejects_binary_formats(self) -> None:
        encoded = base64.b64encode(b"%PDF").decode()
        with self.assertRaises(ValueError):
            extract_text(encoded, "application/pdf")


if __name__ == "__main__":
    unittest.main()
