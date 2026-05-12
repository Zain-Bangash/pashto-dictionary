import dotenv from 'dotenv';
import path from 'path';
dotenv.config({ path: path.resolve(__dirname, '.env') });

import 'express-async-errors';
import express, { Request, Response, NextFunction } from 'express';
import cors from 'cors';
import mongoose from 'mongoose';
import logger from './utils/logger';
import healthRouter from './routes/health';
import authRouter from './routes/auth';
import moderationRouter from './routes/moderation';
import usersRouter from './routes/users';
import conceptsRouter from './routes/concepts';
import variantsRouter from './routes/variants';
import statsRouter from './routes/stats';

const app = express();

app.use(cors());
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

const PORT = process.env.PORT || 5000;

mongoose
  .connect(process.env.MONGODB_URI as string)
  .then(() => {
    logger.info('MongoDB connected');
    app.listen(PORT, () => logger.info(`Server running on port ${PORT}`));
  })
  .catch((err: Error) => {
    logger.error(`MongoDB connection failed: ${err.message}`);
    process.exit(1);
  });
