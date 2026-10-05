import express from 'express';
import cors from 'cors';
import cookieParser from 'cookie-parser';
import config from './config/config';
import logger from './utils/logger';
import routes from './routes';
import { handleErrors } from './errors';
import { connectMongo } from './infra/mongo';
import { detectTransactionSupport } from './infra/transaction';
import { connectRedis } from './infra/redis';
import { getConnection } from './messaging/rabbitmq';
import { isPublisherReady } from './messaging/publisher';
import { registerShutdown, isServiceReady, isShuttingDown } from './lifecycle/gracefulShutdown';
import dns from 'node:dns';

const app = express();

app.use(cookieParser());
app.use(express.json({ limit: '256kb' }));
app.use(express.urlencoded({ extended: true, limit: '256kb' }));
app.set('trust proxy', 1);

const whitelist = [
  'http://localhost:3000',
  'https://admin.baaten.in',
  'https://agency.baaten.in',
  'https://partner.baatein.in',
  'https://webview.baatein.in',
];

app.use(cors({
  origin(origin, callback) {
    callback(null, !origin || whitelist.indexOf(origin) !== -1);
  },
  methods: ['GET', 'PUT', 'PATCH', 'POST', 'DELETE', 'OPTIONS'],
  optionsSuccessStatus: 200,
  credentials: true,
  allowedHeaders: [
    'Content-Type',
    'Authorization',
    'X-Requested-With',
    'device-remember-token',
    'Access-Control-Allow-Origin',
    'Origin',
    'Accept',
    'x-idempotency-key',
    'x-request-id',
    'x-internal-service-key',
  ],
  exposedHeaders: ['auth-token', 'x-request-id'],
}));

// Liveness answers "is the process up", readiness "should it receive traffic".
app.get('/health/live', (_req, res) => {
  res.status(200).json({ status: 'ok' });
});

app.get('/health/ready', (_req, res) => {
  const ready = isServiceReady();
  res.status(ready ? 200 : 503).json({ status: ready ? 'ready' : 'not-ready' });
});

// Refuse new work while draining, so in-flight requests can finish cleanly.
app.use((req, res, next) => {
  if (isShuttingDown()) {
    res.status(503).json({ success: false, message: 'Service is unavailable', code: 'SERVICE_UNAVAILABLE' });
    return;
  }
  next();
});

app.use('/api', routes);

app.use((_req, res) => {
  res.status(404).json({ success: false, message: 'Route not found', code: 'NOT_FOUND' });
});

app.use(handleErrors);

if (dns.getServers().every((s) => s === '127.0.0.1' || s === '::1')) {
  dns.setServers(['8.8.8.8', '1.1.1.1']);
}

// Start infrastructure independently so one transient dependency failure does
// not prevent the process from coming up and reporting readiness correctly.
void connectMongo()
  .then(() => detectTransactionSupport())
  .catch(() => undefined);
void connectRedis().catch((err) => logger.warn({ err: err?.message }, 'redis startup connection failed'));
void getConnection();

const server = app.listen(config.PORT, () => {
  logger.info({ port: config.PORT, env: config.ENV, mode: config.MODE }, 'music-service listening');
});

registerShutdown({ server, readinessChecks: [isPublisherReady] });

export default app;
