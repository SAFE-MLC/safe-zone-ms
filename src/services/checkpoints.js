import { getCheckpointFromCache, setCheckpointInCache } from '../cache.js';
import { fetchCheckpoint } from '../db.js';

export async function getCheckpointCachedOrDB(zoneCheckpointId) {
  let c = await getCheckpointFromCache(zoneCheckpointId);
  if (c) return c;
  const fromDb = await fetchCheckpoint(zoneCheckpointId);
  if (!fromDb) return null;
  await setCheckpointInCache(zoneCheckpointId, fromDb);
  return fromDb;
}
