import 'express-async-errors';
import express, { Request, Response, NextFunction } from 'express';
import cors from 'cors';
import logger from './utils/logger';
import healthRouter from './routes/health';
import authRouter from './routes/auth';
import moderationRouter from './routes/moderation';
import usersRouter from './routes/users';
import conceptsRouter from './routes/concepts';
import variantsRouter from './routes/variants';
import statsRouter from './routes/stats';

const app = express();

app.use(cors({
  origin: [
    'https://main.d1jgu2lev5krpe.amplifyapp.com',
    'http://localhost:5173',
  ],
}));
app.use(express.json());

app.use('/api', healthRouter);
app.use('/api/auth', authRouter);
app.use('/api/moderation', moderationRouter);
app.use('/api/users', usersRouter);
app.use('/api/concepts', conceptsRouter);
app.use('/api/variants', variantsRouter);
app.use('/api/stats', statsRouter);

app.use((err: Error, _req: Request, res: Response, _next: NextFunction) => {
  logger.error(err.message);
  res.status((err as Error & { status?: number }).status || 500).json({
    success: false,
    error: { message: err.message || 'Internal server error' },
  });
});

export default app;
