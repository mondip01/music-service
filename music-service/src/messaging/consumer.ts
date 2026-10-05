import logger from '../utils/logger';
import { getConnection } from './rabbitmq';
import type { ChannelWrapper } from 'amqp-connection-manager';

export interface RegisterConsumerOptions<T> {
  queue: string;
  assertOpts?: Record<string, unknown>;
  prefetch?: number;
  handler: (payload: T, raw: unknown) => Promise<void>;
}

const consumers = new Set<ChannelWrapper>();

export function registerConsumer<T>({
  queue,
  assertOpts = {},
  prefetch = 10,
  handler,
}: RegisterConsumerOptions<T>) {
  const wrapper = getConnection().createChannel({
    json: false,
    setup: async (channel) => {
      logger.info({ queue, prefetch }, 'RabbitMQ consumer channel ready');
      await channel.prefetch(prefetch);
      await channel.assertQueue(queue, assertOpts as any);
      await channel.consume(queue, async (msg) => {
        if (msg === null) return;

        let payload: T;
        try {
          payload = JSON.parse(msg.content.toString()) as T;
        } catch (err: any) {
          logger.error({ err: err?.message, queue }, 'failed to parse message, dropping');
          channel.ack(msg);
          return;
        }

        try {
          await handler(payload, msg);
          channel.ack(msg);
        } catch (err: any) {
          logger.error({ err: err?.message, queue }, 'consumer handler error');
          // Do not requeue poison messages forever. A future version can attach a
          // dead-letter exchange here without changing the consumer contract.
          channel.nack(msg, false, false);
        }
      });
    },
  });

  consumers.add(wrapper);
  wrapper.on('error', (err) => logger.error({ err: err?.message, queue }, 'RabbitMQ channel error'));
  return wrapper;
}

export async function closeConsumers(): Promise<void> {
  const current = [...consumers];
  consumers.clear();
  await Promise.all(current.map((consumer) => consumer.close().catch((err) => {
    logger.warn({ err: err?.message }, 'RabbitMQ consumer close failed');
  })));
}
