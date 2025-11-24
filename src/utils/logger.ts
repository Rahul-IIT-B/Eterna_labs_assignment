import env from '../config/env';

type Details = Record<string, unknown> | undefined;
type Level = 'info' | 'error' | 'debug';

const shouldLogDebug = env.LOG_LEVEL === 'debug';

const write = (level: Level, details?: Details, message?: string) => {
  if (level === 'debug' && !shouldLogDebug) return;
  const line = [new Date().toISOString(), level.toUpperCase(), message].filter(Boolean).join(' ');
  if (details) {
    console.log(line, JSON.stringify(details));
  } else {
    console.log(line);
  }
};

const parseArgs = (detailsOrMessage?: Details | string, message?: string) => {
  if (typeof detailsOrMessage === 'string') {
    return { details: undefined, message: detailsOrMessage };
  }
  return { details: detailsOrMessage, message };
};

const logger = {
  info: (detailsOrMessage?: Details | string, message?: string) => {
    const { details, message: msg } = parseArgs(detailsOrMessage, message);
    write('info', details, msg);
  },
  error: (detailsOrMessage?: Details | string, message?: string) => {
    const { details, message: msg } = parseArgs(detailsOrMessage, message);
    write('error', details, msg);
  },
  debug: (detailsOrMessage?: Details | string, message?: string) => {
    const { details, message: msg } = parseArgs(detailsOrMessage, message);
    write('debug', details, msg);
  }
};

export default logger;
