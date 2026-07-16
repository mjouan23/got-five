import express from 'express';
import cors from 'cors';
import helmet from 'helmet';
import morgan from 'morgan';
import rateLimit from 'express-rate-limit';
import { env } from './config/env.js';
import sessionRoutes from './routes/sessionRoutes.js';
import { errorHandler, notFoundHandler } from './utils/errors.js';

export const app = express();
app.set('trust proxy', 1);

const corsOrigins = env.CLIENT_URL.split(',').map((value) => value.trim());

app.use(helmet());
app.use(
  cors({
    origin: (origin, callback) => {
      if (!origin) {
        callback(null, true);
        return;
      }

      if (corsOrigins.includes(origin)) {
        callback(null, true);
        return;
      }

      callback(new Error('Origine CORS non autorisee'));
    },
    credentials: true
  })
);
app.use(express.json({ limit: '100kb' }));
app.use(morgan('dev'));

const createJoinLimiter = rateLimit({
  windowMs: 60 * 1000,
  max: 20,
  standardHeaders: true,
  legacyHeaders: false
});

app.post('/api/sessions', createJoinLimiter);
app.post('/api/sessions/:sessionCode/join', createJoinLimiter);
app.post('/api/sessions/:sessionCode/reconnect', createJoinLimiter);

app.get('/api/health', (_req, res) => {
  res.json({ ok: true });
});

app.use('/api', sessionRoutes);
app.use(notFoundHandler);
app.use(errorHandler);
