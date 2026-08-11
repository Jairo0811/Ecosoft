export const openApiDocument = {
  openapi: '3.0.3',
  info: {
    title: 'EcoSoft API',
    version: '0.1.0',
    description: 'API para subastas energéticas y contratos PPA. Fase 1: identidad y foundation.',
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
  },
} as const;
