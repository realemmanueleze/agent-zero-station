import { redactFields } from "./redact.ts";

export type LogLevel = "debug" | "info" | "warn" | "error";

export type LogContext = {
  service: string;
  requestId?: string;
  tenantId?: string;
  signalId?: string;
  decisionId?: string;
  producer?: string;
};

export type LoggerOptions = {
  service: string;
  write?: (line: string) => void;
};

export type Logger = {
  debug: (msg: string, fields?: Record<string, unknown>) => void;
  info: (msg: string, fields?: Record<string, unknown>) => void;
  warn: (msg: string, fields?: Record<string, unknown>) => void;
  error: (msg: string, fields?: Record<string, unknown>) => void;
  withContext: (ctx: Partial<LogContext>) => Logger;
};

function emit(
  write: (line: string) => void,
  level: LogLevel,
  msg: string,
  context: LogContext,
  fields?: Record<string, unknown>,
): void {
  const line = {
    level,
    msg,
    time: new Date().toISOString(),
    service: context.service,
    requestId: context.requestId,
    tenantId: context.tenantId,
    signalId: context.signalId,
    decisionId: context.decisionId,
    producer: context.producer,
    ...redactFields(fields),
  };
  write(`${JSON.stringify(line)}\n`);
}

export function createLogger(options: LoggerOptions): Logger {
  const write = options.write ?? ((line) => process.stderr.write(line));
  const base: LogContext = { service: options.service };

  const make = (context: LogContext): Logger => ({
    debug(msg, fields) {
      emit(write, "debug", msg, context, fields);
    },
    info(msg, fields) {
      emit(write, "info", msg, context, fields);
    },
    warn(msg, fields) {
      emit(write, "warn", msg, context, fields);
    },
    error(msg, fields) {
      emit(write, "error", msg, context, fields);
    },
    withContext(ctx) {
      return make({ ...context, ...ctx, service: ctx.service ?? context.service });
    },
  });

  return make(base);
}
