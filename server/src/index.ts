import dotenv from 'dotenv';
import path from 'path';
dotenv.config({ path: path.resolve(__dirname, '.env') });

import mongoose from 'mongoose';
import logger from './utils/logger';
import app from './app';
import { ensureSystemLookups } from './utils/lookups';

const PORT = process.env.PORT || 5000;

mongoose
  .connect(process.env.MONGODB_URI as string)
  .then(async () => {
    logger.info('MongoDB connected');
    const inserted = await ensureSystemLookups();
    if (inserted.length) logger.info(`Seeded system lookups: ${inserted.join(', ')}`);
    app.listen(PORT, () => logger.info(`Server running on port ${PORT}`));
  })
  .catch((err: Error) => {
    logger.error(`MongoDB connection failed: ${err.message}`);
    process.exit(1);
  });
