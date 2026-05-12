const logger = {
  info: (msg: string): void => { process.stdout.write(`[INFO] ${msg}\n`); },
  error: (msg: string): void => { process.stderr.write(`[ERROR] ${msg}\n`); },
};

export default logger;
