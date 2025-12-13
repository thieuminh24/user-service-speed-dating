// src/redis/redis.service.ts
import { Injectable, OnModuleDestroy, Logger } from '@nestjs/common';
import { InjectRedis } from '@nestjs-modules/ioredis';
import Redis from 'ioredis';

@Injectable()
export class RedisService implements OnModuleDestroy {
  private readonly logger = new Logger(RedisService.name);

  constructor(@InjectRedis() public readonly redis: Redis) {}

  async onModuleDestroy() {
    await this.redis.quit();
  }

  // ===== QUEUE OPERATIONS =====
  async pushToQueue(queueName: string, value: string): Promise<number> {
    return this.redis.rpush(queueName, value);
  }

  async popFromQueue(queueName: string): Promise<string | null> {
    return this.redis.lpop(queueName);
  }

  async getQueueLength(queueName: string): Promise<number> {
    return this.redis.llen(queueName);
  }

  async removeFromQueue(queueName: string, value: string): Promise<number> {
    return this.redis.lrem(queueName, 0, value);
  }

  async isInQueue(queueName: string, value: string): Promise<boolean> {
    try {
      // Only use LRANGE for list operations
      const items = await this.redis.lrange(queueName, 0, -1);
      return items.some((item) => {
        try {
          const parsed = JSON.parse(item);
          return parsed.userId === value;
        } catch {
          return item === value;
        }
      });
    } catch (error) {
      // If WRONGTYPE, delete and return false
      if (error.message?.includes('WRONGTYPE')) {
        this.logger.warn(`Queue ${queueName} has wrong type, deleting...`);
        await this.redis.del(queueName);
      } else {
        this.logger.error(`Error checking queue: ${error.message}`);
      }
      return false;
    }
  }

  // ===== KEY-VALUE OPERATIONS =====
  async set(key: string, value: string, ttl?: number): Promise<'OK'> {
    if (ttl) {
      return this.redis.setex(key, ttl, value);
    }
    return this.redis.set(key, value);
  }

  async get(key: string): Promise<string | null> {
    return this.redis.get(key);
  }

  async del(key: string): Promise<number> {
    return this.redis.del(key);
  }

  async exists(key: string): Promise<number> {
    return this.redis.exists(key);
  }

  async expire(key: string, seconds: number): Promise<number> {
    return this.redis.expire(key, seconds);
  }

  // ===== HASH OPERATIONS =====
  async hset(key: string, field: string, value: string): Promise<number> {
    return this.redis.hset(key, field, value);
  }

  async hget(key: string, field: string): Promise<string | null> {
    return this.redis.hget(key, field);
  }

  async hgetall(key: string): Promise<Record<string, string>> {
    return this.redis.hgetall(key);
  }

  async hdel(key: string, field: string): Promise<number> {
    return this.redis.hdel(key, field);
  }

  // ===== SET OPERATIONS =====
  async sadd(key: string, member: string): Promise<number> {
    return this.redis.sadd(key, member);
  }

  async srem(key: string, member: string): Promise<number> {
    return this.redis.srem(key, member);
  }

  async sismember(key: string, member: string): Promise<number> {
    return this.redis.sismember(key, member);
  }

  async smembers(key: string): Promise<string[]> {
    return this.redis.smembers(key);
  }

  // ===== ATOMIC OPERATIONS =====
  async getAndDelete(key: string): Promise<string | null> {
    const pipeline = this.redis.pipeline();
    pipeline.get(key);
    pipeline.del(key);
    const results = await pipeline.exec();
    return results?.[0]?.[1] as string | null;
  }

  // ===== PATTERN MATCHING =====
  async keys(pattern: string): Promise<string[]> {
    return this.redis.keys(pattern);
  }

  async deletePattern(pattern: string): Promise<number> {
    const keys = await this.keys(pattern);
    if (keys.length === 0) return 0;
    return this.redis.del(...keys);
  }

  // ===== HEALTH CHECK =====
  async ping(): Promise<string> {
    return this.redis.ping();
  }
}
