export type LogLevel = "debug" | "info" | "warn" | "error";

export type LogPayload = Record<string, unknown>;

const REDACT_KEYS = /key|secret|token|credential|password|authorization/i;

function truncate(value: unknown, max = 160): unknown {
  if (typeof value === "string") {
    return value.length > max ? `${value.slice(0, max)}…(${value.length})` : value;
  }
  return value;
}

function sanitize(data?: LogPayload): LogPayload | undefined {
  if (!data) return undefined;

  const out: LogPayload = {};
  for (const [key, value] of Object.entries(data)) {
    if (REDACT_KEYS.test(key)) {
      out[key] = value ? "[redacted]" : value;
      continue;
    }
    if (key === "text" || key === "advisorText" || key === "prompt") {
      out[key] = truncate(value);
      continue;
    }
    out[key] = value;
  }
  return out;
}

function emit(level: LogLevel, scope: string, message: string, data?: LogPayload) {
  const prefix = `[radiant:${scope}]`;
  const payload = sanitize(data);
  const line = payload ? `${prefix} ${message}` : `${prefix} ${message}`;

  if (level === "error") {
    console.error(line, payload ?? "");
    return;
  }
  if (level === "warn") {
    console.warn(line, payload ?? "");
    return;
  }
  if (level === "debug") {
    console.debug(line, payload ?? "");
    return;
  }
  console.info(line, payload ?? "");
}

export function createLogger(scope: string) {
  return {
    debug: (message: string, data?: LogPayload) => emit("debug", scope, message, data),
    info: (message: string, data?: LogPayload) => emit("info", scope, message, data),
    warn: (message: string, data?: LogPayload) => emit("warn", scope, message, data),
    error: (message: string, data?: LogPayload) => emit("error", scope, message, data),
    async time<T>(label: string, fn: () => Promise<T>, data?: LogPayload): Promise<T> {
      const start = Date.now();
      emit("info", scope, `${label} start`, data);
      try {
        const result = await fn();
        emit("info", scope, `${label} ok`, { ...data, ms: Date.now() - start });
        return result;
      } catch (error) {
        emit("error", scope, `${label} failed`, {
          ...data,
          ms: Date.now() - start,
          error: error instanceof Error ? error.message : String(error),
        });
        throw error;
      }
    },
  };
}

export function logRouteError(scope: string, error: unknown, data?: LogPayload) {
  createLogger(scope).error("request failed", {
    ...data,
    error: error instanceof Error ? error.message : String(error),
    stack: error instanceof Error ? error.stack : undefined,
  });
}
