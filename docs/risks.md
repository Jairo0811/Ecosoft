# Riesgos técnicos y de producto

| Riesgo                              | Prob. | Impacto | Mitigación                                           |
| ----------------------------------- | ----: | ------: | ---------------------------------------------------- |
| reglas regulatorias ambiguas        |  alta |    alta | catálogos configurables y validación formal          |
| exposición de ofertas               | media | crítica | autorización por estado, cifrado y auditoría         |
| alcance excesivo en 12 meses        |  alta |    alta | fases, MVP y DoD estricto                            |
| concurrencia al cierre              | media |    alta | transacciones, UTC, row version y pruebas de carga   |
| archivos maliciosos                 | media |    alta | allowlist, antivirus, Blob privado y URLs temporales |
| dependencia de proveedor IA/OCR     | media |   media | puertos/adaptadores y contratos propios              |
| datos insuficientes para predicción |  alta |   media | no prometer modelos; medir calidad antes de entrenar |
| divergencia académica/producto      | media |   media | ADRs, backlog trazable y revisión con el equipo      |
