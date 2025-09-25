import express from 'express';
import { config } from './config.js';
import { router as zoneRoutes } from './routes/zone.js';

const app = express();
app.use(express.json());

app.get('/health', (_, res) => res.json({ ok: true }));
app.use(zoneRoutes);

app.listen(config.PORT, () => {
  console.log(`Zone MS listening on :${config.PORT}`);
});
