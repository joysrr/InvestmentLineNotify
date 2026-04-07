import 'dotenv/config';
import Fastify from 'fastify';
import cors from '@fastify/cors';
import { initDataGuard } from './middleware/initDataGuard.mjs';
import statusRoute from './routes/status.mjs';
import reportsRoute from './routes/reports.mjs';
import newsRoute from './routes/news.mjs';

const PORT = parseInt(process.env.PORT || '3000', 10);
const HOST = process.env.HOST || '0.0.0.0';

const fastify = Fastify({
  logger: {
    level: process.env.NODE_ENV === 'dev' ? 'info' : 'warn',
  },
});

// ─── CORS ────────────────────────────────────────────────────────────────────
const corsOrigins = process.env.CORS_ORIGIN
  ? process.env.CORS_ORIGIN.split(',')
  : ['http://localhost:5173', 'http://127.0.0.1:5173'];

await fastify.register(cors, {
  origin: corsOrigins,
  methods: ['GET', 'HEAD', 'OPTIONS'],
});

// ─── Global hook: Telegram initData guard ────────────────────────────────────
fastify.addHook('onRequest', initDataGuard);

// ─── Routes ──────────────────────────────────────────────────────────────────
await fastify.register(statusRoute, { prefix: '/api' });
await fastify.register(reportsRoute, { prefix: '/api' });
await fastify.register(newsRoute, { prefix: '/api' });

// ─── Health check (no auth required, skip guard in middleware) ───────────────
fastify.get('/health', async () => ({ status: 'ok', ts: Date.now() }));

// ─── Start ───────────────────────────────────────────────────────────────────
try {
  await fastify.listen({ port: PORT, host: HOST });
  console.log(`[api] Fastify API Server listening on ${HOST}:${PORT}`);
} catch (err) {
  fastify.log.error(err);
  process.exit(1);
}
