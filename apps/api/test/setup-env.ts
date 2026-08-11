process.env.NODE_ENV = 'test';
process.env.PORT = '4000';
process.env.WEB_ORIGIN = 'http://localhost:5173';
process.env.DATABASE_URL =
  'sqlserver://localhost:1433;database=EcoSoftTest;user=sa;password=TestPassword!123;encrypt=true;trustServerCertificate=true';
process.env.JWT_ACCESS_SECRET = 'test-access-secret-with-at-least-32-chars';
process.env.JWT_REFRESH_SECRET = 'test-refresh-secret-with-at-least-32-chars';
process.env.ACCESS_TOKEN_TTL_SECONDS = '900';
process.env.REFRESH_TOKEN_TTL_DAYS = '7';
