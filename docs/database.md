# Modelo de datos

SQL Server es el sistema de registro. Prisma administra el esquema y las migraciones. Los archivos
usan un adaptador privado local en desarrollo; SQL Server conserva metadatos, hashes y referencias.
Producción puede sustituirlo por Azure Blob Storage.

## ERD inicial y evolución prevista

```mermaid
erDiagram
    Organization ||--o{ User : contains
    User }o--o{ Role : has
    Role }o--o{ Permission : grants
    User ||--o{ RefreshToken : owns
    User ||--o{ UserInvitation : receives
    User ||--o{ UserInvitation : sends
    User ||--o{ AuditLog : performs
    User ||--o{ Organization : reviews
    CatalogItem }o--|| CatalogType : grouped_by
    Organization ||--o{ Auction : manages
    Organization ||--o{ AuctionParticipant : participates
    Auction ||--o{ AuctionRequirement : requires
    Auction ||--o{ AuctionParticipant : enables
    Auction ||--o{ AuctionEvent : records
    Auction ||--o{ CalendarEvent : schedules
    Auction ||--o{ Bid : receives
    Bid ||--o{ BidVersion : versions
    Bid ||--o{ Document : documents
    Bid ||--o{ Evaluation : assessed_by
    Bid ||--o| Award : wins
    Award ||--o| PPAContract : originates
    Organization ||--o{ EnergyProject : develops
    EnergyProject ||--o{ PPAContract : supplies
    PPAContract ||--o{ PPAContractVersion : versions
    PPAContract ||--o{ PPAContractEvent : records
    EnergyProject ||--o{ EnergyProjectEvent : records
    Document ||--o{ DocumentVersion : versions
    Document ||--o{ AIAnalysis : analyzed_by
    Organization ||--o{ Regulation : issues
    Regulation ||--o{ RegulationScope : applies_to
    Regulation ||--o{ RegulationEvent : records
    User ||--o{ Notification : receives
```

La migración de Fase 1 crea identidad, organizaciones, sesiones y auditoría. La Fase 2 amplía la
organización con contactos y decisiones de revisión, agrega un índice único filtrado para permitir
RNC nulo y crea catálogos controlados. Las entidades de dominio se agregan mediante migraciones
consecutivas, con restricciones e índices alineados a sus invariantes.

La ampliación de usuarios agrega `authVersion`, usada para invalidación inmediata de sesiones, y
`UserInvitation`, que conserva el hash del token, emisor, vencimiento, aceptación y revocación.

La Fase 3 incorpora `Auction`, requisitos configurables, participantes autorizados, eventos de
dominio de solo anexado y eventos de calendario. Los hitos automáticos de apertura, cierre,
evaluación y adjudicación se sincronizan con el cronograma. Restricciones SQL Server protegen
capacidad/precio positivos y el orden básico de fechas.

La Fase 7 incorpora la base de agregados analíticos (`Bid`, `Award`, `EnergyProject`,
`PPAContract` y `PPAContractVersion`) necesaria para calcular indicadores sin datos simulados. Los
índices por organización, tecnología, estado, provincia y vencimiento soportan filtros y alertas.
Los reportes se calculan desde las tablas transaccionales; no mantienen una segunda fuente de
verdad ni almacenan archivos exportados en SQL Server.

La Fase 8 agrega `Regulation`, `RegulationScope`, `RegulationEvent` y `Notification`. Las
regulaciones conservan autoridad emisora, vigencia, fuente oficial, referencia documental y
alcances configurables. `RegulationEvent` registra un historial de solo anexado. Las
notificaciones usan la restricción única `(userId, sourceKey)` para que recalcular alertas no
duplique mensajes.

`AuditLog.eventHash` contiene SHA-256 del contenido canónico y redactado del evento. Los triggers
`TR_AuditLog_Immutable` y `TR_RegulationEvent_Immutable` rechazan `UPDATE` y `DELETE` incluso si un
error de aplicación intentara ejecutarlos. Los registros anteriores a la Fase 8 pueden conservar
`eventHash` nulo; todos los eventos nuevos lo incluyen.

Las Fases 4 a 6 agregan versiones inmutables de oferta/documento/PPA, matrices y criterios,
evaluaciones y puntuaciones, e historiales de proyectos y contratos. La Fase 9 agrega `AIAnalysis`
con hash de entrada, proveedor, fuentes, resultado, confianza y decisión de revisión.

## Convenciones

- UUID (`uniqueidentifier`) como clave primaria.
- `createdAt`, `updatedAt` y fechas de negocio en UTC.
- índices únicos en email, RNC no nulo, códigos de rol, permisos y códigos por tipo de catálogo.
- las transiciones sensibles usan actualizaciones condicionales y restricciones únicas para
  detectar concurrencia; las versiones mantienen número y hash únicos por agregado.
- datos críticos no se eliminan físicamente desde la aplicación.
- los hashes de refresh tokens, invitaciones y documentos se almacenan, nunca los valores
  sensibles originales.
