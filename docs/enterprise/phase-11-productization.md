# Fase 11 — Productization

## Objetivo

Separar con claridad el activo académico del producto Enterprise y neutralizar dependencias conceptuales que impedirían vender EcoSoft a otras autoridades u operadores energéticos.

## Decisiones

- **EcoSoft Academic**: conserva el caso de estudio UNAPEC, Grupo #4, CNE y licencia MIT del repositorio público.
- **EcoSoft Enterprise**: evolución comercial configurable, orientada a autoridades reguladoras, operadores, generadoras y desarrolladores energéticos.
- La CNE pasa de ser una suposición estructural a ser una posible organización institucional inicial.
- La edición Enterprise debe poder desplegarse como instancia dedicada por cliente; el multi-tenancy compartido es opcional y debe justificarse por contrato y riesgo.
- La identidad comercial y los derechos sobre nuevas contribuciones Enterprise deben registrarse separadamente de la autoría académica original.

## Posicionamiento

EcoSoft Enterprise es una plataforma EnergyTech/GovTech/RegTech para administrar procesos regulados de adquisición energética: licitaciones, participación, ofertas, evaluación, adjudicación, contratos PPA, seguimiento, regulación, auditoría y analítica.

## Modelo comercial recomendado

- implementación inicial;
- licencia o suscripción Enterprise;
- alojamiento administrado opcional;
- soporte y SLA;
- integraciones y personalizaciones cotizadas;
- capacitación y acompañamiento de adopción.

No se plantea un modelo freemium ni una pasarela de pago dentro del dominio del producto.

## Criterios de aceptación

- [x] Límites Academic/Enterprise documentados.
- [x] Posicionamiento independiente de una sola institución.
- [x] Modelo de despliegue single-tenant Enterprise definido como opción primaria de menor riesgo.
- [x] Reglas de propiedad intelectual y autoría preservadas.
- [x] Ruta de fases 12–18 documentada.
