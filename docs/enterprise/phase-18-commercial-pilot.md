# Fase 18 — Commercial Pilot

## Objetivo

Definir un piloto comercial controlado que permita validar EcoSoft con una organización real antes de declarar Enterprise v1.0 Production Ready.

## Alcance recomendado

El primer piloto debe ejecutarse como **instancia dedicada** y con un proceso no crítico o controlado. Debe incluir usuarios institucionales, al menos una organización participante de prueba, una licitación representativa, oferta, evaluación, adjudicación simulada/controlada, PPA, documentos, reportes y auditoría.

## Onboarding

1. identificar owner ejecutivo y owner operativo del cliente;
2. levantar roles, segregación de funciones y organizaciones;
3. acordar residencia, retención, backups y datos permitidos;
4. configurar dominio, identidad y correo;
5. cargar catálogos sin inventar reglas regulatorias;
6. capacitación por rol;
7. dry run completo;
8. inicio del piloto con canal de soporte y registro de incidencias.

## Métricas

- usuarios invitados/activados;
- tasa de login y bloqueos;
- tiempo para completar flujo de licitación;
- errores por módulo;
- documentos rechazados/cuarentenados;
- latencia p95 de operaciones críticas;
- disponibilidad observada;
- tickets por severidad;
- porcentaje de tareas completadas sin soporte;
- hallazgos de auditoría y correcciones.

## Soporte del piloto

Severidades sugeridas:

- **SEV-1**: indisponibilidad total, pérdida/corrupción de datos o incidente de seguridad activo;
- **SEV-2**: función crítica bloqueada sin workaround razonable;
- **SEV-3**: degradación con workaround;
- **SEV-4**: mejora, consulta o defecto cosmético.

Los tiempos contractuales de respuesta no se fijan hasta conocer capacidad real de soporte.

## Go / No-Go para v1.0

### Go
- flujo end-to-end aceptado por usuarios piloto;
- cero defectos SEV-1 abiertos;
- seguridad y recuperación aprobadas;
- métricas dentro de objetivos acordados;
- documentación operativa entregada;
- riesgos residuales aceptados formalmente.

### No-Go
- aislamiento de datos no demostrado;
- restauración no probada;
- errores críticos de permisos;
- ausencia de owner operativo;
- reglas regulatorias no validadas;
- integraciones críticas sin fallback.

## Resultado de fase

El repositorio queda **Pilot Ready** desde el punto de vista de alcance, arquitectura y criterios. Convertirse en **Production Ready** exige ejecutar este plan contra infraestructura e identidad reales y cerrar el gate de Fase 17.
