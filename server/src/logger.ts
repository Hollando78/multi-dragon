import pino from 'pino';

export const logger = pino({ level: process.env.LOG_LEVEL || 'info' });

export function childLogger(bindings: Record<string, any>) {
  return logger.child(bindings);
}
