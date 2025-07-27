/**
 * Application environment types
 */
export enum NodeEnvironment {
  DEVELOPMENT = 'development',
  PRODUCTION = 'production',
  TEST = 'test',
}

/**
 * Application configuration interface
 */
export interface AppConfig {
  nodeEnv: NodeEnvironment;
  port: number;
  openai: {
    apiKey: string;
    maxRequestsPerMinute: number;
  };
  exchangeRates: {
    apiKey: string;
    cacheTtl: number;
  };
  api: {
    prefix: string;
    version: string;
  };
  data: {
    productsPath: string;
  };
}

/**
 * Validates and returns application configuration
 * @throws {Error} When required environment variables are missing or invalid
 * @returns {AppConfig} Validated configuration object
 */
export function validateConfig(): AppConfig {
  const requiredEnvVars = ['OPENAI_API_KEY', 'EXCHANGE_RATES_API_KEY'];
  const missingVars = requiredEnvVars.filter(
    (varName) => !process.env[varName] || process.env[varName]?.trim() === '',
  );

  if (missingVars.length > 0) {
    throw new Error(
      `Missing required environment variables: ${missingVars.join(', ')}. ` +
        'Please check your .env file and ensure all required variables are set.',
    );
  }

  const port = parseInt(process.env.PORT || '3000', 10);
  if (isNaN(port) || port <= 0 || port > 65535) {
    throw new Error('PORT must be a valid port number between 1 and 65535');
  }

  const maxRequestsPerMinute = parseInt(
    process.env.OPENAI_MAX_REQUESTS_PER_MINUTE || '60',
    10,
  );
  if (isNaN(maxRequestsPerMinute) || maxRequestsPerMinute <= 0) {
    throw new Error(
      'OPENAI_MAX_REQUESTS_PER_MINUTE must be a valid positive number',
    );
  }

  const cacheTtl = parseInt(process.env.EXCHANGE_RATES_CACHE_TTL || '3600', 10);
  if (isNaN(cacheTtl) || cacheTtl <= 0) {
    throw new Error('EXCHANGE_RATES_CACHE_TTL must be a valid positive number');
  }

  const nodeEnv =
    (process.env.NODE_ENV as NodeEnvironment) || NodeEnvironment.DEVELOPMENT;
  if (!Object.values(NodeEnvironment).includes(nodeEnv)) {
    throw new Error(
      `NODE_ENV must be one of: ${Object.values(NodeEnvironment).join(', ')}`,
    );
  }

  const openaiApiKey = process.env.OPENAI_API_KEY!;
  if (!openaiApiKey.startsWith('sk-')) {
    throw new Error(
      'OPENAI_API_KEY must be a valid OpenAI API key starting with "sk-"',
    );
  }

  const exchangeRatesApiKey = process.env.EXCHANGE_RATES_API_KEY!;
  if (exchangeRatesApiKey.length < 16) {
    throw new Error('EXCHANGE_RATES_API_KEY appears to be invalid (too short)');
  }

  return {
    nodeEnv,
    port,
    openai: {
      apiKey: openaiApiKey,
      maxRequestsPerMinute,
    },
    exchangeRates: {
      apiKey: exchangeRatesApiKey,
      cacheTtl,
    },
    api: {
      prefix: process.env.API_PREFIX || 'api',
      version: process.env.API_VERSION || 'v1',
    },
    data: {
      productsPath:
        process.env.PRODUCTS_CSV_PATH ||
        'data/Full Stack Test products_list.csv',
    },
  };
}

/**
 * NestJS ConfigModule validation function
 * @param config - Configuration object to validate
 * @returns {Record<string, unknown>} Validated configuration
 * @throws {Error} When required configuration keys are missing
 */
export const validate = (config: Record<string, unknown>) => {
  const requiredKeys = ['OPENAI_API_KEY', 'EXCHANGE_RATES_API_KEY'];
  const missingKeys = requiredKeys.filter((key) => !config[key]);

  if (missingKeys.length > 0) {
    throw new Error(
      `Configuration validation failed: missing ${missingKeys.join(', ')}`,
    );
  }

  return config;
};

export default () => validateConfig();
