declare global {
  namespace NodeJS {
    interface ProcessEnv {
      DATABASE_URL: string;
      DATABASE_HOST: string;
      DATABASE_PORT: string;
      DATABASE_USER: string;
      DATABASE_PASSWORD: string;
      DATABASE_NAME: string;
      DATABASE_POOL_MAX: string;
      DATABASE_SSL: string;
      NODE_ENV: 'development' | 'production' | 'test';
    }
  }
}

export {};
