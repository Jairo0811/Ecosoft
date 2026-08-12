# Arquitectura de IA y OCR

La IA es un apoyo a decisiones, nunca una autoridad. Se implementará como FastAPI en Fase 9 tras
estabilizar permisos, auditoría y datos de dominio.

## Reglas no negociables

- No adjudica subastas, aprueba contratos ni modifica registros oficiales.
- Toda recomendación separa hechos, inferencias, fuentes y nivel de confianza.
- El acceso respeta organización, rol, confidencialidad y estado de la subasta.
- Prompts, fuentes y resultados sensibles se auditan según la política de retención.
- Los proveedores de modelos y OCR se aíslan tras interfaces sustituibles.
- Ninguna salida del modelo se ejecuta como SQL, código o instrucción privilegiada.

Azure AI Document Intelligence será el primer adaptador OCR y OpenAI/Azure OpenAI serán adaptadores
de modelos. Las interfaces permitirán sustituir proveedores sin cambiar el dominio.
