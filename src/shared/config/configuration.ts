export enum NodeEnvironment {
  DEVELOPMENT = 'development',
  PRODUCTION = 'production',
  TEST = 'test',
}

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

export function validateConfig(): AppConfig {
  const requiredEnvVars = ['OPENAI_API_KEY', 'EXCHANGE_RATES_API_KEY'];
  const missingVars = requiredEnvVars.filter(
    (varName) => !process.env[varName],
  );

  if (missingVars.length > 0) {
    throw new Error(
      `Missing required environment variables: ${missingVars.join(', ')}. ` +
        'Please check your .env file and ensure all required variables are set.',
    );
  }

  const port = parseInt(process.env.PORT || '3000', 10);
  if (isNaN(port) || port <= 0) {
    throw new Error('PORT must be a valid positive number');
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

  return {
    nodeEnv,
    port,
    openai: {
      apiKey: process.env.OPENAI_API_KEY!,
      maxRequestsPerMinute,
    },
    exchangeRates: {
      apiKey: process.env.EXCHANGE_RATES_API_KEY!,
      cacheTtl,
    },
    api: {
      prefix: process.env.API_PREFIX || 'api',
      version: process.env.API_VERSION || 'v1',
    },
    data: {
      productsPath: process.env.PRODUCTS_CSV_PATH || 'data/products_list.csv',
    },
  };
}

export default () => validateConfig();
