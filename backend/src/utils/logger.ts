type LogLevel = "info" | "warn" | "error" | "debug";

const log = (level: LogLevel, ...args: unknown[]) => {
  const ts = new Date().toISOString();
  console[level](`[${ts}] [${level.toUpperCase()}]`, ...args);
};

export const logger = {
  info: (...args: unknown[]) => log("info", ...args),
  warn: (...args: unknown[]) => log("warn", ...args),
  error: (...args: unknown[]) => log("error", ...args),
  debug: (...args: unknown[]) => log("debug", ...args),
};
