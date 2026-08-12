# EcoSoft

**Sistema de Gestión de Subastas Energéticas y Contratos PPA**  
EcoSoft Solutions S.R.L. · Comisión Nacional de Energía (CNE)

EcoSoft centraliza la convocatoria, participación, evaluación, adjudicación y trazabilidad de
subastas de energía renovable, además del ciclo de vida de contratos Power Purchase Agreement.
El producto prioriza transparencia, seguridad, auditoría y decisiones humanas verificables. No es
un ERP y no incluye nómina, inventario, contabilidad, facturación ni pagos.

> Estado: Fases 0 y 1 completadas; Fase 2 en revisión. El logo horizontal oficial está integrado;
> el isotipo, favicon y variante para fondos claros se incorporarán cuando sean entregados.

## Alcance inicial

- Monorepo TypeScript con React/Vite y Node.js/Express.
- SQL Server y Prisma ORM.
- Login, logout, refresh token rotativo y sesiones revocables.
- RBAC con roles y permisos granulares validados en backend.
- Organizaciones, aprobación de participantes, catálogos, usuarios y auditoría.
- Dashboard corporativo accesible con modo claro/oscuro.
- OpenAPI, logging estructurado, correlation IDs y health checks.
- Docker Compose, pruebas y GitHub Actions.

## Arquitectura

Se usa un monolito modular para evitar complejidad distribuida prematura. Los contextos de dominio
se mantienen aislados para permitir una extracción futura. La IA será un servicio independiente,
solo consultivo y sin capacidad de modificar datos oficiales.

```text
apps/web        React + Material UI
apps/api        Express + Prisma + SQL Server
apps/ai-service FastAPI (reservado para Fase 9)
packages/shared Contratos compartidos sin lógica sensible
docs/           Arquitectura, seguridad, API, ERD, backlog y ADRs
```

## Requisitos

- Node.js 20.19+ (recomendado 22 LTS)
- npm 10+
- Docker Desktop o SQL Server 2022

## Puesta en marcha

```bash
cp .env.example .env
docker compose up -d sqlserver
npm install
npm run db:generate
npm run db:migrate
npm run db:seed
npm run dev
```

Web: `http://localhost:5173` · API: `http://localhost:4000` · Swagger:
`http://localhost:4000/api/docs`

Credenciales de desarrollo creadas por el seed:

- Usuario: `admin@ecosoft.com.do`
- Contraseña: el valor de `SEED_ADMIN_PASSWORD`; si no se define, el seed se detiene.

## Calidad

```bash
npm run format:check
npm run lint
npm run typecheck
npm test
npm run build
```

## Documentación

- [Arquitectura](docs/architecture.md)
- [Base de datos](docs/database.md)
- [Seguridad](docs/security.md)
- [API](docs/api.md)
- [IA](docs/ai.md)
- [Despliegue](docs/deployment.md)
- [MVP y supuestos](docs/requirements/mvp.md)
- [Backlog](docs/backlog.md)
- [Riesgos](docs/risks.md)

## Roadmap

1. Foundation, autenticación y RBAC.
2. Organizaciones y participantes.
3. Licitaciones, subastas y calendario.
4. Ofertas inmutables y documentos.
5. Evaluaciones configurables y adjudicaciones.
6. Contratos PPA y proyectos energéticos.
7. Analítica y reportes.
8. Auditoría, regulación y notificaciones.
9. IA/OCR con aprobación humana.
10. Hardening, accesibilidad WCAG 2.2 AA y preparación productiva.

## Equipo

Grupo #4 · Proyecto de Software 1 (ISO-705) · Universidad APEC

- Emely Marie Castillo Rivera — A00110380
- Héctor David Pichardo Ortiz — A001110746 (líder)
- Nathaly Patricia Tamayo Ortiz — A00113859
- Francis Jairo Matías Rosario — A00115261

Profesor: Ing. Santo Rafael Navarro.

## Licencia

[MIT](LICENSE) © 2026 Jairo Matías.
