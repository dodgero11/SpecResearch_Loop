export type RuntimeConfig = {
  DATABASE_URL: string;
  PORT: number;
  INTERNAL_API_KEY: string;
  /** Base URL of the Python AI microservice. When unset, the local mock LLM adapter is used. */
  AI_SERVICE_URL?: string;
  AI_SERVICE_TIMEOUT_MS: number;
};

export const DEFAULT_AI_SERVICE_TIMEOUT_MS = 90_000;

export function getRequiredConfig(env: NodeJS.ProcessEnv = process.env): RuntimeConfig {
  const databaseUrl = env.DATABASE_URL?.trim();
  const portValue = env.PORT?.trim();
  const internalApiKey = env.INTERNAL_API_KEY?.trim();

  if (!databaseUrl) {
    throw new Error('Missing required env var: DATABASE_URL');
  }

  if (!portValue || Number(portValue) <= 0) {
    throw new Error('Missing required env var: PORT');
  }

  if (!internalApiKey) {
    throw new Error('Missing required env var: INTERNAL_API_KEY');
  }

  const aiServiceUrl = env.AI_SERVICE_URL?.trim() || undefined;
  if (aiServiceUrl) {
    try {
      const parsedUrl = new URL(aiServiceUrl);
      if (parsedUrl.protocol !== 'http:' && parsedUrl.protocol !== 'https:') {
        throw new Error(`unsupported protocol: ${parsedUrl.protocol}`);
      }
    } catch {
      throw new Error(`Invalid env var AI_SERVICE_URL: "${aiServiceUrl}" is not a valid http(s) URL`);
    }
  }

  const timeoutValue = env.AI_SERVICE_TIMEOUT_MS?.trim();
  let aiServiceTimeoutMs = DEFAULT_AI_SERVICE_TIMEOUT_MS;
  if (timeoutValue) {
    const parsedTimeout = Number(timeoutValue);
    if (!Number.isInteger(parsedTimeout) || parsedTimeout <= 0) {
      throw new Error(`Invalid env var AI_SERVICE_TIMEOUT_MS: "${timeoutValue}" must be a positive integer`);
    }
    aiServiceTimeoutMs = parsedTimeout;
  }

  return {
    DATABASE_URL: databaseUrl,
    PORT: Number(portValue),
    INTERNAL_API_KEY: internalApiKey,
    AI_SERVICE_URL: aiServiceUrl,
    AI_SERVICE_TIMEOUT_MS: aiServiceTimeoutMs,
  };
}
