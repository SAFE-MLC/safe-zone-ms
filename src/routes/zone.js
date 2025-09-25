import express from 'express';
import jwt from 'jsonwebtoken';
import { config } from '../config.js';
import { getTicketCachedOrDB } from '../services/tickets.js';
import { getCheckpointCachedOrDB } from '../services/checkpoints.js';
import { auditZoneEnter } from '../db.js';
import { appendZoneLog } from '../cache.js';

export const router = express.Router();

router.post('/zones/checkpoint/scan', async (req, res) => {
  try {
    let { qr, ticketId, zoneCheckpointId } = req.body || {};
    if (!zoneCheckpointId || (!qr && !ticketId)) {
      return res.status(400).json({ error: 'zoneCheckpointId and (qr or ticketId) are required' });
    }

    if (qr) {
      try {
        const payload = jwt.verify(qr, config.SESSION_KEY, { algorithms: ['HS256'] });
        ticketId = payload.sub || payload.tid;
        if ((payload.evt || '') !== config.EVENT_ID) return res.json({ decision: 'DENY', reason: 'INVALID' });
      } catch {
        return res.json({ decision: 'DENY', reason: 'EXPIRED|INVALID' });
      }
    }

    const cp = await getCheckpointCachedOrDB(zoneCheckpointId);
    if (!cp) return res.json({ decision: 'DENY', reason: 'NOT_FOUND' });
    if (cp.eventId !== config.EVENT_ID) return res.json({ decision: 'DENY', reason: 'INVALID' });

    const t = await getTicketCachedOrDB(ticketId);
    if (!t) return res.json({ decision: 'DENY', reason: 'NOT_FOUND' });
    if (t.eventId !== config.EVENT_ID) return res.json({ decision: 'DENY', reason: 'INVALID' });

    if (!Array.isArray(t.entitlements) || !t.entitlements.includes(cp.zoneId)) {
      return res.json({ decision: 'DENY', reason: 'NO_ENTITLEMENT' });
    }

    await auditZoneEnter(ticketId, cp.zoneId, zoneCheckpointId);
    await appendZoneLog(config.EVENT_ID, { ticketId, zoneId: cp.zoneId, checkpointId: zoneCheckpointId, ts: Date.now(), direction: 'IN' });

    return res.json({ decision: 'ALLOW' });
  } catch (e) {
    console.error(e);
    return res.status(500).json({ error: 'internal_error' });
  }
});
