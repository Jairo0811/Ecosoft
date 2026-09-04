# Fase 14 — Multi-Organization

## Objetivo

Formalizar el aislamiento organizacional existente como una estrategia de tenancy Enterprise y eliminar la suposición de que toda instalación representa únicamente a la CNE.

## Estrategia

EcoSoft admite dos topologías comerciales:

### Instancia dedicada (recomendada inicialmente)
Una instalación por autoridad/cliente, con múltiples organizaciones participantes dentro de esa instancia. Reduce superficie de aislamiento y simplifica residencia de datos, contratos, soporte y recuperación.

### SaaS compartido
Una plataforma con múltiples tenants raíz. Solo debe habilitarse cuando todas las consultas, jobs, almacenamiento, cache, telemetría y exportaciones incorporen un `tenantId` obligatorio y existan pruebas negativas automatizadas de aislamiento.

## Modelo actual

El MVP ya limita usuarios, ofertas, contratos, documentos, notificaciones y otros recursos por `organizationId` y roles. Para una instancia dedicada, ese modelo actúa como frontera empresarial entre organizaciones participantes.

## Reglas de contexto

- nunca aceptar el tenant/organización efectivo únicamente desde un header enviado por el cliente;
- derivar organización y permisos desde la identidad autenticada;
- las operaciones institucionales globales requieren permisos explícitos;
- jobs y notificaciones deben ejecutar con un contexto de tenant/instalación explícito;
- logs y métricas deben incluir un identificador no sensible de instalación/tenant;
- storage debe prefijar claves por instalación y organización;
- exportaciones deben aplicar exactamente el mismo scope que las consultas en pantalla.

## Criterios de aceptación de foundation

- [x] Topologías dedicated/shared definidas.
- [x] Instancia dedicada seleccionada como estrategia comercial inicial.
- [x] Reglas de tenant context documentadas.
- [x] Identidad de instalación parametrizable en backend.
- [ ] `tenantId` persistente en todas las entidades para SaaS compartido.
- [ ] batería completa de pruebas cross-tenant.

Los dos últimos requisitos solo son obligatorios antes de ofrecer un SaaS compartido; no bloquean un despliegue Enterprise dedicado.
