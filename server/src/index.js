require('dotenv').config();
require('express-async-errors');
const express = require('express');
const cors = require('cors');
const mongoose = require('mongoose');
const logger = require('./utils/logger');
const healthRouter = require('./routes/health');
const authRouter = require('./routes/auth');
const moderationRouter = require('./routes/moderation');
const usersRouter = require('./routes/users');
const conceptsRouter = require('./routes/concepts');
const variantsRouter = require('./routes/variants');

const app = express();

app.use(cors());
app.use(express.json());

app.use('/api', healthRouter);
app.use('/api/auth', authRouter);
app.use('/api/moderation', moderationRouter);
app.use('/api/users', usersRouter);
app.use('/api/concepts', conceptsRouter);
app.use('/api/variants', variantsRouter);

app.use((err, _req, res, _next) => {
  logger.error(err.message);
  res.status(err.status || 500).json({
    success: false,
    error: { message: err.message || 'Internal server error' },
  });
});

module.exports = app;

const PORT = process.env.PORT || 5000;

mongoose
  .connect(process.env.MONGODB_URI)
  .then(() => {
    logger.info('MongoDB connected');
    app.listen(PORT, () => logger.info(`Server running on port ${PORT}`));
  })
  .catch((err) => {
    logger.error(`MongoDB connection failed: ${err.message}`);
    process.exit(1);
  });
