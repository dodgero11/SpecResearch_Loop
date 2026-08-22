export type RuntimeConfig = {
  DATABASE_URL: string;
  PORT: number;
  INTERNAL_API_KEY: string;
};

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

  return {
    DATABASE_URL: databaseUrl,
    PORT: Number(portValue),
    INTERNAL_API_KEY: internalApiKey,
  };
}
