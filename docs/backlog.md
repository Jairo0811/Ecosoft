# Backlog

## MVP académico — Fases 0–10

| Prioridad | Épica         | Estado     | Resultado verificable                                          |
| --------: | ------------- | ---------- | -------------------------------------------------------------- |
|        P0 | Foundation    | Completada | monorepo, SQL Server, CI, logging, health y documentación      |
|        P0 | Identity      | Completada | login, refresh rotativo, logout, RBAC, bloqueo y auditoría     |
|        P0 | Organizations | Completada | autoridad, empresas, aprobación y usuarios de organización     |
|        P0 | Auctions      | Completada | ciclo de vida, requisitos, participantes, cronograma y eventos |
|        P0 | Bids          | Completada | borrador, envío inmutable, hash, versiones y confidencialidad  |
|        P0 | Evaluations   | Completada | matrices configurables, doble evaluación y resultado trazable  |
|        P0 | Awards        | Completada | resolución, aprobación y no eliminación física                 |
|        P0 | Contracts     | Completada | PPA, versiones, estados, capacidad y vencimientos              |
|        P1 | Projects      | Completada | capacidad, tecnología, ubicación y estado operacional          |
|        P1 | Documents     | Completada | almacenamiento privado, versiones, metadata, hash y análisis   |
|        P1 | Reporting     | Completada | dashboard, filtros, PDF/Excel/CSV y métricas energéticas       |
|        P1 | Governance    | Completada | regulación, auditoría inmutable y alertas por usuario          |
|        P2 | AI/OCR        | Completada | extracción, resumen y anomalías con aprobación humana          |

## Productización Enterprise — Fases 11–18

| Fase | Incremento | Estado | Resultado verificable |
| ---: | --- | --- | --- |
| 11 | Productization | Implementada | separación Academic/Enterprise, posicionamiento y modelo comercial |
| 12 | Production Security | Implementada | baseline productivo y hardening parametrizable |
| 13 | Enterprise Identity | Foundation | política MFA, configuración OIDC/SAML y validación fail-fast |
| 14 | Multi-Organization | Foundation | topología dedicada/compartida y tenant context derivado de identidad |
| 15 | Cloud & Observability | Foundation | topología Azure, ambientes, telemetría, SLO y runbooks |
| 16 | Integrations | Foundation | contratos seguros y firma HMAC para webhooks |
| 17 | Compliance & Scale | Foundation | gate de seguridad, DR, retención y pruebas de carga |
| 18 | Commercial Pilot | Implementada | onboarding, métricas, soporte y criterios go/no-go |

`Foundation` indica que el producto contiene el contrato, configuración y controles internos necesarios, pero el cierre de la fase productiva depende de infraestructura, proveedores o evidencia externa real. Consulta [`enterprise/README.md`](enterprise/README.md).
