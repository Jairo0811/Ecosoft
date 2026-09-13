# Contribuir a EcoSoft

EcoSoft está congelado como **proyecto académico de portafolio**. El repositorio se encuentra en estado **Completed · Academic Portfolio · Maintenance Only**.

## Cambios aceptados

A partir del freeze, solo se consideran cambios de mantenimiento:

- correcciones críticas de seguridad;
- correcciones que restauren la reproducibilidad local o la CI;
- actualización de enlaces rotos o documentación objetivamente incorrecta;
- ajustes menores de compatibilidad necesarios para mantener el proyecto demostrable;
- correcciones legales o de atribución debidamente sustentadas.

No se aceptan nuevas funcionalidades de negocio, nuevas fases del roadmap, migraciones de arquitectura por modernización, integraciones comerciales adicionales ni ampliaciones de alcance salvo que el proyecto sea reactivado explícitamente.

## Flujo de trabajo

1. Cree una rama desde `main` con el prefijo `fix/`, `docs/`, `chore/` o `security/`.
2. Use Conventional Commits y mantenga cada cambio enfocado.
3. Ejecute `npm run format:check`, `npm run lint`, `npm run typecheck`, `npm test` y `npm run build` cuando el cambio afecte código o dependencias.
4. No incluya secretos, datos reales de empresas ni documentos regulatorios confidenciales.
5. Abra un pull request con contexto, evidencia de pruebas y riesgos conocidos.

Los cambios de autorización, auditoría, contratos PPA o adjudicaciones requieren revisión cuidadosa. Ninguna regla regulatoria se implementará sin una fuente formal.

Para el criterio completo de congelación y preservación, consulte [`docs/portfolio-freeze.md`](docs/portfolio-freeze.md).
