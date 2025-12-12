import { Kafka, Producer, Consumer, logLevel } from 'kafkajs';

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
    const brokers = process.env.KAFKA_BROKERS?.split(',').filter(Boolean);
    this.topic = topic;
    if (brokers && brokers.length > 0) {
      const kafka = new Kafka({
        brokers,
        clientId: 'connect4-backend',
        logLevel: logLevel.NOTHING,
      });
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
  handlers?: { log?: (msg: string) => void };
}): Promise<Consumer | null> {
  const brokers = process.env.KAFKA_BROKERS?.split(',').filter(Boolean);
  if (!brokers || brokers.length === 0) return null;
  const kafka = new Kafka({
    brokers,
    clientId: 'connect4-analytics',
    logLevel: logLevel.INFO,
  });
  const consumer = kafka.consumer({ groupId });
  await consumer.connect();
  await consumer.subscribe({ topic, fromBeginning: false });
  await consumer.run({
    eachMessage: async ({ message }) => {
      const payload = message.value?.toString() ?? '';
      handlers?.log?.(payload);
    },
  });
  return consumer;
}
