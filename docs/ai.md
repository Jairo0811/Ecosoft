# Arquitectura de IA y OCR

`apps/ai-service` implementa un servicio FastAPI aislado. La API Node valida permisos y ámbito
organizacional, lee el documento privado, invoca el servicio con timeout, almacena el resultado y
registra la operación en auditoría.

## Operaciones

| Operación        | Entrada                      | Resultado verificable                          |
| ---------------- | ---------------------------- | ---------------------------------------------- |
| `OCR`            | Documento textual versionado | Texto, fuente, proveedor y confianza           |
| `SUMMARY`        | Texto extraído               | Resumen extractivo, hechos y referencias       |
| `ANOMALY_REVIEW` | Texto extraído               | Señales heurísticas con oración de procedencia |

El proveedor `LOCAL_DETERMINISTIC` permite probar el circuito sin enviar datos a terceros. Solo
extrae UTF-8 de formatos textuales; PDF e imágenes requieren un adaptador OCR productivo como Azure
AI Document Intelligence. Los modelos OpenAI/Azure OpenAI se conectan detrás del mismo contrato
después de aprobar privacidad, residencia, retención y credenciales.

## Reglas no negociables

- No adjudica subastas, aprueba contratos ni modifica decisiones oficiales.
- Cada salida conserva proveedor, hash de entrada, fuentes y nivel de confianza.
- El acceso respeta organización, rol, confidencialidad y estado documental.
- Un usuario con `ai.review` acepta o rechaza una salida una sola vez y deja notas.
- Ninguna salida se ejecuta como SQL, código o instrucción privilegiada.
- Los resultados se presentan como asistencia y requieren revisión humana.

## Ejecución y pruebas

```bash
docker compose up -d ai-service
curl http://localhost:8000/health
PYTHONPATH=apps/ai-service python -m unittest discover -s apps/ai-service/tests -v
```
