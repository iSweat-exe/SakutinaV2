type LogContext = Record<string, unknown>;

function write(level: string, message: string, context: LogContext = {}): void {
  console.log(
    JSON.stringify({
      level,
      message,
      timestamp: new Date().toISOString(),
      ...context,
    }),
  );
}

export const logger = {
  info(message: string, context?: LogContext): void {
    write("info", message, context);
  },

  warn(message: string, context?: LogContext): void {
    write("warn", message, context);
  },

  error(message: string, context?: LogContext): void {
    write("error", message, context);
  },
};
