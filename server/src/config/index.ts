import 'dotenv/config';
export const env = {
  port: Number(process.env.PORT) || 4000,
  databaseUrl: process.env.DATABASE_URL,
  kafkaBrokers: process.env.KAFKA_BROKERS,
  kafkaSaslUsername: process.env.KAFKA_SASL_USERNAME,
  kafkaSaslPassword: process.env.KAFKA_SASL_PASSWORD,
  kafkaSaslMechanism: process.env.KAFKA_SASL_MECHANISM,
  kafkaSsl: process.env.KAFKA_SSL,
  redisUrl: process.env.REDIS_URL,
  frontendUrl: process.env.FRONTEND_URL,
};
export function assertEnv(): void {
  if (!env.databaseUrl) {
    throw new Error('DATABASE_URL is required for Postgres persistence');
  }
}
