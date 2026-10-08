import dotenv from 'dotenv';
dotenv.config();

import serverless from 'serverless-http';
import mongoose from 'mongoose';
import app from './app';
import logger from './utils/logger';
import { ensureSystemLookups } from './utils/lookups';

let isConnected = false;

const handler = serverless(app);

export const lambdaHandler = async (event: any, context: any) => {
  context.callbackWaitsForEmptyEventLoop = false;
  if (!isConnected) {
    await mongoose.connect(process.env.MONGODB_URI as string);
    isConnected = true;
    await ensureSystemLookups().catch((err: Error) => logger.error(`ensureSystemLookups failed: ${err.message}`));
  }
  return handler(event, context);
};
