export const openApiDocument = {
  openapi: '3.0.3',
  info: {
    title: 'EcoSoft API',
    version: '0.3.0',
    description:
      'API para subastas energéticas y contratos PPA. Fase 2: organizaciones, catálogos y usuarios.',
  },
  servers: [{ url: '/api/v1' }],
  components: {
    securitySchemes: {
      bearerAuth: { type: 'http', scheme: 'bearer', bearerFormat: 'JWT' },
    },
  },
  paths: {
    '/health/live': {
      get: { summary: 'Liveness', responses: { '200': { description: 'Servicio activo' } } },
    },
    '/health/ready': {
      get: {
        summary: 'Readiness',
        responses: { '200': { description: 'Dependencias disponibles' } },
      },
    },
    '/auth/login': {
      post: {
        summary: 'Iniciar sesión',
        requestBody: {
          required: true,
          content: {
            'application/json': {
              schema: {
                type: 'object',
                required: ['email', 'password'],
                properties: {
                  email: { type: 'string', format: 'email' },
                  password: { type: 'string', format: 'password' },
                },
              },
            },
          },
        },
        responses: {
          '200': { description: 'Sesión creada' },
          '401': { description: 'Credenciales inválidas' },
        },
      },
    },
    '/auth/refresh': {
      post: {
        summary: 'Rotar sesión',
        responses: {
          '200': { description: 'Tokens renovados' },
          '401': { description: 'Sesión inválida' },
        },
      },
    },
    '/auth/logout': {
      post: {
        summary: 'Cerrar sesión',
        security: [{ bearerAuth: [] }],
        responses: { '204': { description: 'Sesión revocada' } },
      },
    },
    '/auth/me': {
      get: {
        summary: 'Identidad actual',
        security: [{ bearerAuth: [] }],
        responses: { '200': { description: 'Usuario autenticado' } },
      },
    },
    '/auth/invitations/validate': {
      post: {
        summary: 'Validar una invitación de cuenta',
        responses: {
          '200': { description: 'Invitación vigente' },
          '410': { description: 'Invitación inválida, vencida o utilizada' },
        },
      },
    },
    '/auth/invitations/accept': {
      post: {
        summary: 'Activar una cuenta invitada y definir su contraseña',
        responses: {
          '204': { description: 'Cuenta activada' },
          '410': { description: 'Invitación inválida, vencida o utilizada' },
        },
      },
    },
    '/users': {
      get: {
        summary: 'Listar usuarios dentro del ámbito administrativo',
        security: [{ bearerAuth: [] }],
        responses: { '200': { description: 'Listado paginado' } },
      },
    },
    '/users/invitations': {
      get: {
        summary: 'Listar invitaciones dentro del ámbito administrativo',
        security: [{ bearerAuth: [] }],
        responses: { '200': { description: 'Listado paginado' } },
      },
      post: {
        summary: 'Invitar o reinvitar un usuario',
        security: [{ bearerAuth: [] }],
        responses: {
          '201': { description: 'Invitación creada' },
          '403': { description: 'Organización o rol fuera del ámbito' },
        },
      },
    },
    '/users/{id}/status': {
      patch: {
        summary: 'Suspender o reactivar una cuenta y revocar sus sesiones',
        security: [{ bearerAuth: [] }],
        parameters: [
          { name: 'id', in: 'path', required: true, schema: { type: 'string', format: 'uuid' } },
        ],
        responses: { '200': { description: 'Estado actualizado' } },
      },
    },
    '/users/{id}/roles': {
      put: {
        summary: 'Reemplazar roles y revocar sesiones activas',
        security: [{ bearerAuth: [] }],
        parameters: [
          { name: 'id', in: 'path', required: true, schema: { type: 'string', format: 'uuid' } },
        ],
        responses: { '200': { description: 'Roles actualizados' } },
      },
    },
    '/organizations': {
      get: {
        summary: 'Listar organizaciones',
        security: [{ bearerAuth: [] }],
        parameters: [
          { name: 'q', in: 'query', schema: { type: 'string' } },
          { name: 'status', in: 'query', schema: { type: 'string' } },
          { name: 'type', in: 'query', schema: { type: 'string' } },
          { name: 'page', in: 'query', schema: { type: 'integer', minimum: 1 } },
          {
            name: 'pageSize',
            in: 'query',
            schema: { type: 'integer', minimum: 1, maximum: 100 },
          },
        ],
        responses: { '200': { description: 'Listado paginado' } },
      },
      post: {
        summary: 'Registrar organización',
        security: [{ bearerAuth: [] }],
        responses: {
          '201': { description: 'Organización registrada' },
          '409': { description: 'RNC ya registrado' },
        },
      },
    },
    '/organizations/{id}/status': {
      patch: {
        summary: 'Revisar, aprobar, rechazar o suspender una organización',
        security: [{ bearerAuth: [] }],
        parameters: [
          { name: 'id', in: 'path', required: true, schema: { type: 'string', format: 'uuid' } },
        ],
        responses: {
          '200': { description: 'Estado actualizado y auditado' },
          '404': { description: 'Organización inexistente' },
        },
      },
    },
    '/catalogs': {
      get: {
        summary: 'Listar elementos de catálogo',
        security: [{ bearerAuth: [] }],
        parameters: [
          { name: 'type', in: 'query', schema: { type: 'string' } },
          { name: 'active', in: 'query', schema: { type: 'boolean' } },
        ],
        responses: { '200': { description: 'Elementos ordenados por catálogo' } },
      },
      post: {
        summary: 'Crear elemento de catálogo',
        security: [{ bearerAuth: [] }],
        responses: {
          '201': { description: 'Elemento creado' },
          '409': { description: 'Código duplicado en el catálogo' },
        },
      },
    },
    '/catalogs/{id}/status': {
      patch: {
        summary: 'Activar o desactivar un elemento de catálogo',
        security: [{ bearerAuth: [] }],
        parameters: [
          { name: 'id', in: 'path', required: true, schema: { type: 'string', format: 'uuid' } },
        ],
        responses: { '200': { description: 'Estado actualizado' } },
      },
    },
  },
} as const;
