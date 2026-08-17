# ADR-004: puerto para eventos de subasta en tiempo real

## Estado

Aceptada.

## Contexto

La Fase 3 necesita preparar actualizaciones en tiempo real, pero todavía no existe recepción de
ofertas ni una regla regulatoria que determine qué datos pueden difundirse a cada participante.
Agregar Socket.IO y salas antes de definir esos consumidores introduciría infraestructura sin un
caso operativo completo y aumentaría el riesgo de revelar información competitiva.

## Decisión

El módulo Auctions publica sus cambios de estado a través del puerto `AuctionRealtimePublisher`.
La implementación actual es local y sin transporte. En un incremento posterior se incorporará un adaptador
Socket.IO con autenticación, salas por subasta y organización, filtros de payload y auditoría.

Los eventos persistentes de `AuctionEvent` siguen siendo la fuente trazable. El transporte en
tiempo real nunca será el sistema de registro.

## Consecuencias

- El dominio no dependerá de Socket.IO.
- La API puede incorporar WebSockets sin modificar la máquina de estados.
- No se emite información de ofertas antes de definir reglas formales de confidencialidad.
- Los clientes que se reconecten recuperarán el estado oficial mediante REST y no dependerán de
  mensajes efímeros.
