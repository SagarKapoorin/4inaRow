import { randomUUID } from 'crypto';
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

export type AnalyticsRecord = AnalyticsEvent & { id: string };

export class AnalyticsBuffer {
  private events: AnalyticsRecord[] = [];
  private limit: number;
  private dedupe = new Set<string>();

  constructor(limit = 200) {
    this.limit = limit;
  }

  record(event: AnalyticsEvent) {
    const key = this.eventKey(event);
    if (this.dedupe.has(key)) return;
    const record = { id: randomUUID(), ...event };
    this.events.unshift(record);
    this.dedupe.add(key);
    while (this.events.length > this.limit) {
      const removed = this.events.pop();
      if (removed) {
        this.dedupe.delete(this.eventKey(removed));
      }
    }
  }

  all(): AnalyticsRecord[] {
    const seen = new Set<string>();
    const unique: AnalyticsRecord[] = [];
    for (const evt of this.events) {
      const key = this.eventKey(evt);
      if (seen.has(key)) continue;
      seen.add(key);
      unique.push(evt);
    }
    // Keep dedupe set aligned with what we will return/store
    this.dedupe = seen;
    return unique;
  }

  private eventKey(event: AnalyticsEvent): string {
    switch (event.type) {
      case 'game_started':
        return `${event.type}:${event.gameId}:${event.players.red}:${event.players.yellow}:${event.isBot}:${event.at}`;
      case 'move_made':
        return `${event.type}:${event.gameId}:${event.by}:${event.column}:${event.moveNumber}:${event.at}`;
      case 'game_finished':
        return `${event.type}:${event.gameId}:${event.winner ?? 'null'}:${event.isDraw}:${event.durationMs}:${event.at}`;
      default:
        return JSON.stringify(event);
    }
  }
}

export class AnalyticsProducer {
  private producer: Producer | null = null;
  private topic: string;
  private buffer?: AnalyticsBuffer;

  constructor(buffer?: AnalyticsBuffer, topic = 'connect4.analytics') {
    const brokers = process.env.KAFKA_BROKERS?.split(',').filter(Boolean);
    this.topic = topic;
    this.buffer = buffer;
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
    this.buffer?.record(event);
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
      try {
        const parsed = JSON.parse(payload) as AnalyticsEvent;
        if (parsed?.type) handlers?.onEvent?.(parsed);
      } catch {
  console.error('Failed to parse analytics event:', payload); }
    },
  });
  return consumer;
}
