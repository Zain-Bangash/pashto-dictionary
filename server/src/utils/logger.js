const logger = {
  info: (msg) => process.stdout.write(`[INFO] ${msg}\n`),
  error: (msg) => process.stderr.write(`[ERROR] ${msg}\n`),
};

module.exports = logger;
