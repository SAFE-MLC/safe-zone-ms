import express from 'express';
import jwt from 'jsonwebtoken';
import { config } from '../config.js';
import { getTicketCachedOrDB } from '../services/tickets.js';
import { getCheckpointCachedOrDB } from '../services/checkpoints.js';
import { auditZoneEnter } from '../db.js';
import { appendZoneLog } from '../cache.js';
import { log } from '../logger.js';

export const router = express.Router();

router.post('/zones/checkpoint/scan', async (req, res) => {
  const started = Date.now();

  try {
    let { qr, ticketId, zoneCheckpointId } = req.body || {};
    if (!zoneCheckpointId || (!qr && !ticketId)) {
      log({
        event: 'zone_decision',
        decision: 'DENY',
        reason: 'BAD_REQUEST',
        zoneCheckpointId: zoneCheckpointId || null,
        elapsed_ms: Date.now() - started,
      });
      return res.status(400).json({ error: 'zoneCheckpointId and (qr or ticketId) are required' });
    }

    log({
      event: 'zone_attempt',
      zoneCheckpointId,
      has_qr: Boolean(qr),
      has_ticketId: Boolean(ticketId),
      eventId: config.EVENT_ID,
    });

    if (qr) {
      try {
        const payload = jwt.verify(qr, config.SESSION_KEY, { algorithms: ['HS256'] });
        ticketId = payload.sub || payload.tid;
        if ((payload.evt || '') !== config.EVENT_ID) {
          log({
            event: 'zone_decision',
            decision: 'DENY',
            reason: 'INVALID',
            zoneCheckpointId,
            ticketId: ticketId || null,
            elapsed_ms: Date.now() - started,
          });
          return res.json({ decision: 'DENY', reason: 'INVALID' });
        }
      } catch {
        log({
          event: 'zone_decision',
          decision: 'DENY',
          reason: 'EXPIRED|INVALID',
          zoneCheckpointId,
          elapsed_ms: Date.now() - started,
        });
        return res.json({ decision: 'DENY', reason: 'EXPIRED|INVALID' });
      }
    }

    const cp = await getCheckpointCachedOrDB(zoneCheckpointId);
    if (!cp) {
      log({ event: 'zone_decision', decision: 'DENY', reason: 'NOT_FOUND', zoneCheckpointId, elapsed_ms: Date.now() - started });
      return res.json({ decision: 'DENY', reason: 'NOT_FOUND' });
    }
    if (cp.eventId !== config.EVENT_ID) {
      log({ event: 'zone_decision', decision: 'DENY', reason: 'INVALID', zoneCheckpointId, zoneId: cp.zoneId, elapsed_ms: Date.now() - started });
      return res.json({ decision: 'DENY', reason: 'INVALID' });
    }

    const t = await getTicketCachedOrDB(ticketId);
    if (!t) {
      log({ event: 'zone_decision', decision: 'DENY', reason: 'NOT_FOUND', zoneCheckpointId, ticketId, elapsed_ms: Date.now() - started });
      return res.json({ decision: 'DENY', reason: 'NOT_FOUND' });
    }
    if (t.eventId !== config.EVENT_ID) {
      log({ event: 'zone_decision', decision: 'DENY', reason: 'INVALID', zoneCheckpointId, ticketId, elapsed_ms: Date.now() - started });
      return res.json({ decision: 'DENY', reason: 'INVALID' });
    }

    if (!Array.isArray(t.entitlements) || !t.entitlements.includes(cp.zoneId)) {
      log({
        event: 'zone_decision',
        decision: 'DENY',
        reason: 'NO_ENTITLEMENT',
        zoneCheckpointId,
        zoneId: cp.zoneId,
        ticketId,
        elapsed_ms: Date.now() - started,
      });
      return res.json({ decision: 'DENY', reason: 'NO_ENTITLEMENT' });
    }

    await auditZoneEnter(ticketId, cp.zoneId, zoneCheckpointId);
    await appendZoneLog(config.EVENT_ID, {
      ticketId,
      zoneId: cp.zoneId,
      checkpointId: zoneCheckpointId,
      ts: Date.now(),
      direction: 'IN',
    });

    log({
      event: 'zone_decision',
      decision: 'ALLOW',
      zoneCheckpointId,
      zoneId: cp.zoneId,
      ticketId,
      elapsed_ms: Date.now() - started,
      entitlements_count: Array.isArray(t.entitlements) ? t.entitlements.length : 0,
    });

    return res.json({ decision: 'ALLOW' });
  } catch (e) {
    log({
      level: 'error',
      event: 'zone_error',
      msg: e?.message || 'unknown_error',
      stack: e?.stack || null,
      elapsed_ms: Date.now() - started,
    });
    return res.status(500).json({ error: 'internal_error' });
  }
});
