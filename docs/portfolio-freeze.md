# EcoSoft — Portfolio Freeze

## Estado

**Completed · Academic Portfolio · Maintenance Only**

EcoSoft queda congelado como proyecto académico de portafolio. El alcance funcional y técnico previsto para esta edición se considera cerrado. No se planifican nuevas funcionalidades en este repositorio salvo que el proyecto sea reactivado explícitamente en el futuro.

## Propósito del freeze

Este repositorio preserva dos etapas claramente diferenciadas:

1. **MVP académico (Fases 0–10):** proyecto desarrollado por el Grupo #4 de UNAPEC para la asignatura Proyecto de Software 1 (ISO-705), período Mayo–Agosto 2026.
2. **Evolución de portafolio (Fases 11–18):** productización técnica posterior que conserva el linaje académico y demuestra capacidades Enterprise/Pilot Ready sin declarar operación productiva real.

La evolución posterior no reemplaza ni reescribe la autoría, el contexto, el equipo o el alcance histórico del proyecto académico.

## Snapshots de referencia

| Snapshot | Referencia | Propósito |
| --- | --- | --- |
| Academic baseline | `archive/academic-v1.0.0` → `18032be874c11890d93c89937e300382d646775c` | Estado previo a la productización Enterprise; preserva la referencia académica/base del portafolio. |
| Portfolio freeze | `archive/portfolio-v2.0.0` | Se fija sobre el commit final de esta fase después de validar y fusionar el cierre. |

Las ramas `archive/*` funcionan como referencias históricas de preservación. Si en el futuro se crean tags o GitHub Releases equivalentes, deberán apuntar a los mismos snapshots y no reescribir estas referencias.

## Política de mantenimiento

A partir del freeze, solo se consideran cambios válidos:

- correcciones críticas de seguridad;
- correcciones que restauren la reproducibilidad local o la CI;
- actualización de enlaces rotos o documentación objetivamente incorrecta;
- correcciones menores de compatibilidad necesarias para mantener el proyecto demostrable;
- ajustes legales o de atribución debidamente sustentados.

Quedan fuera del mantenimiento ordinario:

- nuevas funcionalidades de negocio;
- nuevas fases del roadmap;
- migraciones de arquitectura por modernización;
- integraciones comerciales adicionales;
- despliegue productivo, multi-tenant comercial o infraestructura cloud real;
- incorporación de proveedores externos únicamente para ampliar alcance.

Cualquier reactivación de producto debe tratarse como una iniciativa nueva y explícita, preferiblemente separada del snapshot académico congelado.

## Interpretación correcta del estado

- **Proyecto académico:** completo.
- **Pieza de portafolio:** completa y congelada.
- **Enterprise MVP / Pilot Ready:** describe la madurez técnica de la evolución posterior.
- **Production Ready:** no declarado.
- **Producto comercial operando en producción:** no declarado.

Los elementos dependientes de infraestructura o proveedores reales —por ejemplo SSO corporativo, Key Vault, correo transaccional, DAST/pentest, restore drills, almacenamiento productivo y pruebas de carga con objetivos contractuales— no forman parte del criterio de cierre académico.

## Regla de preservación

El historial del Grupo #4, la información académica, colaboradores, licencia y documentación técnica deben conservarse. El freeze no convierte la obra grupal original en propiedad exclusiva de una sola persona ni elimina las atribuciones existentes.

---

**Freeze de portafolio:** septiembre de 2026.
