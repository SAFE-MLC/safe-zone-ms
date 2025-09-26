import express from 'express';
import { config } from './config.js';
import { router as zoneRoutes } from './routes/zone.js';
import { log } from './logger.js';

const app = express();
app.use(express.json());

app.use((req, res, next) => {
  const started = Date.now();
  res.on('finish', () => {
    log({
      event: 'http_response',
      method: req.method,
      path: req.originalUrl || req.url,
      status: res.statusCode,
      elapsed_ms: Date.now() - started,
    });
  });
  next();
});

app.get('/health', (_req, res) => {
  log({ event: 'healthcheck', status: 'ok' });
  res.json({ ok: true });
});

app.use(zoneRoutes);

app.listen(config.PORT, () => {
  log({ event: 'server_start', msg: `Zone MS listening on :${config.PORT}` });
});
