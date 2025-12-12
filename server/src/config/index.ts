import 'dotenv/config';
export const env = {
  port: Number(process.env.PORT) || 4000,
  databaseUrl: process.env.DATABASE_URL,
  kafkaBrokers: process.env.KAFKA_BROKERS,
};
export function assertEnv(): void {
  if (!env.databaseUrl) {
    throw new Error('DATABASE_URL is required for Postgres persistence');
  }
}
