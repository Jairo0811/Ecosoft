# MVP y supuestos

## MVP

El primer producto utilizable permite que una autoridad energética administre organizaciones y usuarios; publique una subasta; habilite participantes; reciba ofertas versionadas; configure una matriz de evaluación; registre una adjudicación; genere un contrato PPA; y consulte trazabilidad y reportes básicos.

## Fuera del MVP académico

Multi-tenancy SaaS compartido, ejecución automática de decisiones por IA, pagos, nómina, contabilidad, inventario, CRM genérico y reglas regulatorias no formalizadas.

La evolución Enterprise posterior al MVP se documenta en [`../enterprise/README.md`](../enterprise/README.md). Una instancia dedicada puede operar múltiples organizaciones participantes utilizando el aislamiento organizacional existente sin requerir multi-tenancy SaaS compartido.

## Supuestos documentados

- La CNE es la organización institucional inicial del caso académico, pero las autoridades son configurables y no forman parte de una dependencia comercial obligatoria.
- Moneda, zona horaria, tecnología renovable, criterios y reglas de subasta se modelan como catálogos configurables.
- La matrícula documentada de Héctor David Pichardo Ortiz es **A00110746**, consistente con el README vigente del proyecto.
- La identidad visual oficial de EcoSoft se encuentra en `apps/web/public/branding/` y se conserva como parte del caso académico.
- No se inventan plazos, umbrales o procedimientos regulatorios de CNE, MEM, SIE ni de autoridades futuras; cualquier regla productiva debe ser validada formalmente por el operador competente.
