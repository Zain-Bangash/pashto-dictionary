import mongoose from 'mongoose';
import { ensureSystemLookups } from '../../utils/lookups';

// Test files wipe collections between tests; put the built-in list values back before each one
beforeEach(async () => {
  if (mongoose.connection.readyState === 1) await ensureSystemLookups();
});
