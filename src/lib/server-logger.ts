import "server-only";

import { env } from "@/constants";

type LogLevel = "debug" | "info" | "warn" | "error";
type LogFields = Record<string, unknown>;

const REDACTED = "[REDACTED]";
const MAX_DEPTH = 6;
const MAX_ITEMS = 50;
const MAX_STRING_LENGTH = 4_000;

const SENSITIVE_KEYS = new Set([
  "authorization",
  "cookie",
  "cookies",
  "setcookie",
  "password",
  "currentpassword",
  "newpassword",
  "confirmpassword",
  "token",
  "accesstoken",
  "refreshtoken",
  "sessiontoken",
  "sessioncookie",
  "jwt",
  "secret",
  "sessionsecret",
  "apikey",
  "apisecret",
  "cloudinaryapisecret",
  "databaseurl",
  "directurl",
  "questionanswer",
  "answerkey",
  "correctanswer",
  "selectedanswer",
  "answers",
  "explanation",
  "email",
  "username",
  "displayname",
  "ip",
  "ipaddress",
  "userid",
]);

function normalizeKey(key: string) {
  return key.toLowerCase().replace(/[^a-z0-9]/g, "");
}

function isSensitiveKey(key: string) {
  const normalized = normalizeKey(key);
  return (
    SENSITIVE_KEYS.has(normalized) ||
    normalized.endsWith("password") ||
    normalized.endsWith("token") ||
    normalized.endsWith("secret") ||
    normalized.endsWith("cookie")
  );
}

function redactString(value: string) {
  const redacted = value
    .replace(/\bBearer\s+[^\s,;]+/gi, "Bearer [REDACTED]")
    .replace(/\beyJ[A-Za-z0-9_-]+\.[A-Za-z0-9_-]+\.[A-Za-z0-9_-]+\b/g, REDACTED)
    .replace(
      /((?:password|token|secret|cookie|authorization|api[_-]?key|question[_-]?answer|selected[_-]?answer|correct[_-]?answer|answer[_-]?key|answers|explanation|user[_-]?id)\s*[=:]\s*)([^\s,;]+)/gi,
      `$1${REDACTED}`,
    )
    .replace(/(postgres(?:ql)?:\/\/)[^@\s]+@/gi, `$1${REDACTED}@`);

  const withoutPersonalData = redacted
    .replace(/\b[A-Z0-9._%+-]+@[A-Z0-9.-]+\.[A-Z]{2,}\b/gi, "[REDACTED_EMAIL]")
    .replace(/\b(?:\d{1,3}\.){3}\d{1,3}\b/g, "[REDACTED_IP]");

  return withoutPersonalData.length > MAX_STRING_LENGTH
    ? `${withoutPersonalData.slice(0, MAX_STRING_LENGTH)}...[TRUNCATED]`
    : withoutPersonalData;
}

function redactValue(
  value: unknown,
  key: string | undefined,
  depth: number,
  seen: WeakSet<object>,
): unknown {
  if (key && isSensitiveKey(key)) return REDACTED;
  if (value === null || value === undefined) return value ?? null;
  if (typeof value === "string") return redactString(value);
  if (typeof value === "number") return Number.isFinite(value) ? value : String(value);
  if (typeof value === "bigint") return value.toString();
  if (typeof value === "boolean") return value;
  if (typeof value === "symbol" || typeof value === "function") return `[${typeof value}]`;
  if (depth >= MAX_DEPTH) return "[MAX_DEPTH]";

  if (value instanceof Date) return value.toISOString();
  if (value instanceof URL) return redactString(value.toString());

  if (value instanceof Error) {
    const errorRecord: LogFields = {
      name: value.name,
      message: redactString(value.message),
    };
    if (env.NODE_ENV !== "production" && value.stack) {
      errorRecord.stack = redactString(value.stack);
    }
    if ("digest" in value && typeof value.digest === "string") {
      errorRecord.digest = redactString(value.digest);
    }
    if (value.cause !== undefined) {
      errorRecord.cause = redactValue(value.cause, "cause", depth + 1, seen);
    }
    return errorRecord;
  }

  if (typeof value === "object") {
    if (seen.has(value)) return "[CIRCULAR]";
    seen.add(value);

    if (Array.isArray(value)) {
      return value
        .slice(0, MAX_ITEMS)
        .map((item) => redactValue(item, undefined, depth + 1, seen));
    }

    const entries = Object.entries(value).slice(0, MAX_ITEMS);
    return Object.fromEntries(
      entries.map(([entryKey, entryValue]) => [
        entryKey,
        redactValue(entryValue, entryKey, depth + 1, seen),
      ]),
    );
  }

  return String(value);
}

export function redactSensitiveData(value: unknown) {
  return redactValue(value, undefined, 0, new WeakSet<object>());
}

export function getSafeRequestPath(path: string) {
  try {
    return new URL(path, "http://localhost").pathname;
  } catch {
    return path.split("?", 1)[0]?.slice(0, 500) || "/";
  }
}

export function logServerEvent(level: LogLevel, event: string, fields: LogFields = {}) {
  const payload = redactSensitiveData({
    timestamp: new Date().toISOString(),
    level,
    service: "jlpt-exam",
    event,
    ...fields,
  });
  const message = JSON.stringify(payload);

  if (level === "error") {
    console.error(message);
  } else if (level === "warn") {
    console.warn(message);
  } else if (level === "debug") {
    console.debug(message);
  } else {
    console.info(message);
  }
}

export function reportServerError(event: string, error: unknown, fields: LogFields = {}) {
  logServerEvent("error", event, { ...fields, error });
}
