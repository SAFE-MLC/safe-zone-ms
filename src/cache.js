import Redis from 'ioredis';
import { config } from './config.js';

export const redis = new Redis(config.REDIS_URL);

export async function getTicketFromCache(ticketId) {
  const v = await redis.get(`ticket:${ticketId}`);
  return v ? JSON.parse(v) : null;
}
export async function setTicketInCache(ticketId, doc, ttl = 3600) {
  await redis.setex(`ticket:${ticketId}`, ttl, JSON.stringify(doc));
}

export async function getCheckpointFromCache(id) {
  const v = await redis.get(`checkpoint:${id}`);
  return v ? JSON.parse(v) : null;
}
export async function setCheckpointInCache(id, doc) {
  await redis.set(`checkpoint:${id}`, JSON.stringify(doc));
}

export async function appendZoneLog(eventId, log) {
  await redis.rpush(`scanlog:zone:${eventId}`, JSON.stringify(log));
}
