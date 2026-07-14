// Set environment variables before any application module is imported.
// This lets config/env.ts load deterministically during tests.
process.env.NODE_ENV = 'test';
process.env.PORT = '3999';
process.env.HOST = '127.0.0.1';
process.env.FBR_BASE_URL = 'https://gw.fbr.gov.pk/di_data/v1/di';
process.env.FBR_SANDBOX_TOKEN = 'test-token';
process.env.BRIDGE_API_KEY = 'test-bridge-api-key';
process.env.ALLOWED_ORIGINS = 'https://app.example';
process.env.REQUEST_TIMEOUT_MS = '5000';
process.env.LOG_LEVEL = 'silent';
process.env.FBR_MOCK_MODE = 'true';
