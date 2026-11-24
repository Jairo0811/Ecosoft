# Arquitectura de IA y OCR

`apps/ai-service` implementa un servicio FastAPI aislado. La API Node valida permisos y ámbito
organizacional, lee el documento privado, invoca el servicio con timeout, almacena el resultado y
registra la operación en auditoría.

## Operaciones

| Operación        | Entrada                     | Resultado verificable                          |
| ---------------- | --------------------------- | ---------------------------------------------- |
| `OCR`            | Documento `.txt` versionado | Texto UTF-8, fuente, proveedor y confianza     |
| `SUMMARY`        | Texto extraído              | Resumen extractivo, hechos y referencias       |
| `ANOMALY_REVIEW` | Texto extraído              | Señales heurísticas con oración de procedencia |

El nombre histórico de la operación es `OCR`, pero con el proveedor incluido **no hay OCR**.

El proveedor `LOCAL_DETERMINISTIC` permite probar el circuito sin enviar datos a terceros y es el
único implementado:

- **Procesamiento determinista, sin IA generativa.** El resumen es extractivo (primeras oraciones)
  y la revisión de anomalías usa heurísticas por palabras clave y montos repetidos.
- **Extracción de texto UTF-8, no OCR.** La API solo envía documentos `text/plain`; el resto
  responde `422 TEXT_EXTRACTION_UNSUPPORTED`. PDF (escaneados o con texto), imágenes y DOCX/XLSX no
  se procesan.
- **Capacidades declaradas.** El servicio expone `GET /v1/capabilities` y la API lo publica como
  `GET /api/v1/ai/capabilities` (permiso `ai.use`), limitando los formatos a los que la API
  realmente reenvía. La pantalla de asistencia documental se basa en esa respuesta para no
  prometer OCR ni generación.
- Las señales se limitan a 100 por resultado y se marcan como truncadas si hay más.

OCR real (por ejemplo Azure AI Document Intelligence) y modelos OpenAI/Azure OpenAI son
adaptadores futuros detrás del mismo contrato; requieren aprobar privacidad, residencia, retención
y credenciales, y no forman parte de esta edición.

## Reglas no negociables

- No adjudica subastas, aprueba contratos ni modifica decisiones oficiales.
- Cada salida conserva proveedor, hash de entrada, fuentes y nivel de confianza.
- El acceso respeta organización, rol, confidencialidad y estado documental.
- Un usuario con `ai.review` acepta o rechaza una salida una sola vez y deja notas.
- Ninguna salida se ejecuta como SQL, código o instrucción privilegiada.
- Los resultados se presentan como asistencia y requieren revisión humana; la revisión exige notas
  (mínimo 5 caracteres) y es definitiva.
- El servicio FastAPI no tiene autenticación propia: Docker Compose lo publica solo en
  `127.0.0.1`, la documentación interactiva está desactivada y el contenedor corre sin root.

## Ejecución y pruebas

```bash
docker compose up -d ai-service
curl http://localhost:8000/health
curl http://localhost:8000/v1/capabilities
PYTHONPATH=apps/ai-service python -m unittest discover -s apps/ai-service/tests -v
```
