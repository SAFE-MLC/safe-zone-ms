import pkg from 'pg';
import { config } from './config.js';
const { Pool } = pkg;

export const pool = new Pool(config.PG);

export async function fetchTicketWithEntitlements(ticketId) {
  const q = `
    SELECT t.id AS ticket_id, t.status, t.event_id,
           COALESCE(ARRAY_AGG(ze.zone_id) FILTER (WHERE ze.zone_id IS NOT NULL), '{}') AS entitlements
    FROM tickets t
    LEFT JOIN zone_entitlements ze ON ze.ticket_id = t.id
    WHERE t.id = $1
    GROUP BY t.id, t.status, t.event_id
  `;
  const { rows } = await pool.query(q, [ticketId]);
  if (!rows.length) return null;
  const r = rows[0];
  return { ticketId: r.ticket_id, status: r.status, eventId: r.event_id, entitlements: r.entitlements || [] };
}

export async function fetchCheckpoint(zoneCheckpointId) {
  const q = `
    SELECT zc.id AS zone_checkpoint_id, z.id AS zone_id, z.name AS zone_name, z.event_id
    FROM zone_checkpoints zc JOIN zones z ON zc.zone_id = z.id
    WHERE zc.id = $1
  `;
  const { rows } = await pool.query(q, [zoneCheckpointId]);
  if (!rows.length) return null;
  const r = rows[0];
  return { zoneId: r.zone_id, zoneName: r.zone_name, eventId: r.event_id };
}

export async function auditZoneEnter(ticketId, zoneId, checkpointId) {
  await pool.query('SELECT zone_enter($1,$2,$3)', [ticketId, zoneId, checkpointId]);
}
