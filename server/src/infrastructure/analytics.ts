import { Kafka, Producer, Consumer, logLevel, SASLOptions, KafkaConfig } from 'kafkajs';
import { env } from '../config/index.js';

export type AnalyticsEvent =
  | {
      type: 'game_started';
      gameId: string;
      players: { red: string; yellow: string };
      isBot: boolean;
      at: number;
    }
  | {
      type: 'move_made';
      gameId: string;
      by: string;
      column: number;
      moveNumber: number;
      at: number;
    }
  | {
      type: 'game_finished';
      gameId: string;
      winner: string | null;
      isDraw: boolean;
      durationMs: number;
      at: number;
    };

export class AnalyticsProducer {
  private producer: Producer | null = null;
  private topic: string;

  constructor(topic = 'connect4.analytics') {
    const brokers = env.kafkaBrokers?.split(',').filter(Boolean);
    this.topic = topic;
    if (brokers && brokers.length > 0) {
      const kafkaConfig: KafkaConfig = {
        brokers,
        clientId: 'connect4-backend',
        logLevel: logLevel.NOTHING,
      };
      const sasl = buildSaslConfig();
      if (sasl) kafkaConfig.sasl = sasl;
      if (shouldUseSsl()) kafkaConfig.ssl = true;
      const kafka = new Kafka(kafkaConfig);
      this.producer = kafka.producer();
      this.producer.connect().catch(() => {
        this.producer = null;
      });
    }
  }

  async publish(event: AnalyticsEvent): Promise<void> {
    if (!this.producer) {
      return;
    }
    await this.producer.send({
      topic: this.topic,
      messages: [{ key: event.type, value: JSON.stringify(event) }],
    });
  }
}

export async function startAnalyticsConsumer({
  topic = 'connect4.analytics',
  groupId = 'connect4-analytics-consumer',
  handlers,
}: {
  topic?: string;
  groupId?: string;
  handlers?: { log?: (msg: string) => void; onEvent?: (event: AnalyticsEvent) => void };
}): Promise<Consumer | null> {
  const brokers = env.kafkaBrokers?.split(',').filter(Boolean);
  if (!brokers || brokers.length === 0) return null;
  const kafkaConfig: KafkaConfig = {
    brokers,
    clientId: 'connect4-analytics',
    logLevel: logLevel.INFO,
  };
  const sasl = buildSaslConfig();
  if (sasl) kafkaConfig.sasl = sasl;
  if (shouldUseSsl()) kafkaConfig.ssl = true;
  const kafka = new Kafka(kafkaConfig);
  const consumer = kafka.consumer({ groupId });
  await consumer.connect();
  await consumer.subscribe({ topic, fromBeginning: false });
  await consumer.run({
    eachMessage: async ({ message }) => {
      const payload = message.value?.toString() ?? '';
      handlers?.log?.(payload);
      try {
        const parsed = JSON.parse(payload) as AnalyticsEvent;
        if (parsed?.type) handlers?.onEvent?.(parsed);
      } catch (err) {
        console.error('Failed to parse analytics event:', payload, err);
      }
    },
  });
  return consumer;
}

function buildSaslConfig(): SASLOptions | null {
  const username = env.kafkaSaslUsername;
  const password = env.kafkaSaslPassword;
  const mechanismEnv = env.kafkaSaslMechanism?.toLowerCase();
  if (!username || !password || !mechanismEnv) return null;
  const mechanism = mechanismEnv as SASLOptions['mechanism'];
  if (mechanism === 'plain' || mechanism === 'scram-sha-256' || mechanism === 'scram-sha-512') {
    return { mechanism, username, password };
  }
  return null;
}

function shouldUseSsl(): boolean {
  if (!env.kafkaSsl) return false;
  return env.kafkaSsl.toLowerCase() === 'true' || env.kafkaSsl === '1';
}
