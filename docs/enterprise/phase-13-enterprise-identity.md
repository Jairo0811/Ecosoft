# Fase 13 — Enterprise Identity

## Objetivo

Permitir que cada instalación Enterprise adopte políticas de autenticación más estrictas sin acoplar el dominio a un proveedor de identidad concreto.

## Capacidades

- autenticación local existente como fallback configurable;
- política `MFA_REQUIRED` para instalaciones que exijan segundo factor;
- OIDC como integración preferida para Microsoft Entra ID, Auth0, Okta u otro IdP compatible;
- SAML como adaptador opcional cuando una organización heredada lo requiera;
- cierre de sesiones locales mediante `authVersion` y revocación de refresh tokens;
- autorización interna basada en roles/permisos de EcoSoft incluso cuando la autenticación sea federada.

## Contrato OIDC

Una instalación que active OIDC debe definir como mínimo:

- issuer URL HTTPS;
- client ID;
- audience/resource cuando aplique;
- estrategia de mapeo de `sub`/correo a usuario EcoSoft;
- claims permitidos para organización y roles;
- política de aprovisionamiento: previo, JIT controlado o SCIM futuro.

La identidad externa autentica; **EcoSoft sigue autorizando**. No se confían roles administrativos enviados arbitrariamente por el IdP.

## MFA

`MFA_REQUIRED` expresa la política de la instalación. El factor puede ser satisfecho por el IdP empresarial; si se implementa MFA local posteriormente, debe usar TOTP/WebAuthn, recovery codes de un solo uso y secretos cifrados, nunca almacenados en texto plano.

## Criterios de aceptación de foundation

- [x] Configuración Enterprise modelada sin proveedor obligatorio.
- [x] Validación fail-fast para OIDC activado sin issuer/client ID.
- [x] Política MFA representable por ambiente.
- [x] Contrato de confianza IdP/EcoSoft documentado.
- [ ] Flujo OIDC real probado contra el IdP del cliente.
- [ ] MFA real probado en producción o staging del cliente.

Los dos últimos puntos requieren un proveedor/tenant externo y no se declaran activos desde el repositorio por sí solo.
