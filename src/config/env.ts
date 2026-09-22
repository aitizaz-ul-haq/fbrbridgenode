import { config as loadDotenv } from 'dotenv';

// Load .env only for local development. Production secrets live on the droplet.
loadDotenv();

function requireString(name: string, fallback?: string): string {
  const value = process.env[name] ?? fallback;
  if (value === undefined || value.trim() === '') {
    throw new Error(`Missing required environment variable: ${name}`);
  }
  return value;
}

function parseNumber(name: string, fallback: number): number {
  const raw = process.env[name];
  if (raw === undefined || raw.trim() === '') {
    return fallback;
  }
  const parsed = Number(raw);
  if (!Number.isFinite(parsed) || parsed <= 0) {
    throw new Error(`Environment variable ${name} must be a positive number`);
  }
  return parsed;
}

function parseBoolean(name: string, fallback: boolean): boolean {
  const raw = process.env[name];
  if (raw === undefined || raw.trim() === '') {
    return fallback;
  }
  return raw.trim().toLowerCase() === 'true';
}

const nodeEnv = process.env.NODE_ENV ?? 'development';
const isProduction = nodeEnv === 'production';

const mockMode = parseBoolean('FBR_MOCK_MODE', false);

// Safety guard: never allow mock mode in production.
if (isProduction && mockMode) {
  throw new Error('FBR_MOCK_MODE must not be enabled when NODE_ENV=production');
}

const allowedOrigins = (process.env.ALLOWED_ORIGINS ?? '')
  .split(',')
  .map((origin) => origin.trim())
  .filter((origin) => origin.length > 0);

if (isProduction && allowedOrigins.length === 0) {
  throw new Error('ALLOWED_ORIGINS must be set in production. Wildcard CORS is not allowed.');
}

// The FBR token is not strictly required when mock mode is active, so the
// project can run locally before the sandbox token is issued.
const fbrSandboxToken = mockMode
  ? (process.env.FBR_SANDBOX_TOKEN ?? '')
  : requireString('FBR_SANDBOX_TOKEN');

// The production token is optional so the bridge can run with sandbox only.
// A production request without a resolvable token yields FBR_TOKEN_MISSING.
const fbrProductionToken = process.env.FBR_PRODUCTION_TOKEN ?? '';

export const env = {
  nodeEnv,
  isProduction,
  port: parseNumber('PORT', 3001),
  host: process.env.HOST ?? '127.0.0.1',

  fbrBaseUrl: requireString('FBR_BASE_URL', 'https://gw.fbr.gov.pk/di_data/v1/di'),
  fbrSandboxToken,
  fbrProductionToken,

  bridgeApiKey: requireString('BRIDGE_API_KEY'),
  allowedOrigins,

  requestTimeoutMs: parseNumber('REQUEST_TIMEOUT_MS', 30000),
  logLevel: process.env.LOG_LEVEL ?? 'info',

  mockMode,

  // Environment used when a request does not specify `X-FBR-Environment`.
  // Reported in the /health response.
  defaultEnvironment: 'sandbox' as const,
} as const;

export type Env = typeof env;
