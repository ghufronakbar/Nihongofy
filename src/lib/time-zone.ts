export const DEFAULT_TIME_ZONE = "Asia/Jakarta";

export const COMMON_TIME_ZONES = [
  "Asia/Jakarta",
  "Asia/Makassar",
  "Asia/Jayapura",
  "Asia/Tokyo",
  "Asia/Singapore",
  "Asia/Kuala_Lumpur",
  "Asia/Bangkok",
  "UTC",
] as const;

export type TimeZoneOption = {
  value: string;
  label: string;
  offsetLabel: string;
  offsetMinutes: number;
};

type ZonedDateTimeParts = {
  year: number;
  month: number;
  day: number;
  hour: number;
  minute: number;
  second: number;
  millisecond: number;
};

const formatterCache = new Map<string, Intl.DateTimeFormat>();

function getPartsFormatter(timeZone: string) {
  const cached = formatterCache.get(timeZone);
  if (cached) return cached;

  const formatter = new Intl.DateTimeFormat("en-CA-u-ca-gregory-nu-latn-hc-h23", {
    timeZone,
    year: "numeric",
    month: "2-digit",
    day: "2-digit",
    hour: "2-digit",
    minute: "2-digit",
    second: "2-digit",
    hourCycle: "h23",
  });
  formatterCache.set(timeZone, formatter);
  return formatter;
}

function getZonedParts(date: Date, timeZone: string): ZonedDateTimeParts {
  const values = new Map(
    getPartsFormatter(timeZone)
      .formatToParts(date)
      .filter((part) => part.type !== "literal")
      .map((part) => [part.type, Number(part.value)]),
  );

  return {
    year: values.get("year") ?? 0,
    month: values.get("month") ?? 0,
    day: values.get("day") ?? 0,
    hour: values.get("hour") ?? 0,
    minute: values.get("minute") ?? 0,
    second: values.get("second") ?? 0,
    millisecond: date.getUTCMilliseconds(),
  };
}

function partsAsUtc(parts: ZonedDateTimeParts) {
  return Date.UTC(
    parts.year,
    parts.month - 1,
    parts.day,
    parts.hour,
    parts.minute,
    parts.second,
    parts.millisecond,
  );
}

function getOffsetMinutes(date: Date, timeZone: string) {
  return Math.round(
    (partsAsUtc(getZonedParts(date, timeZone)) - date.getTime()) / 60_000,
  );
}

function formatOffset(offsetMinutes: number) {
  const sign = offsetMinutes >= 0 ? "+" : "-";
  const absoluteMinutes = Math.abs(offsetMinutes);
  const hours = Math.floor(absoluteMinutes / 60).toString().padStart(2, "0");
  const minutes = (absoluteMinutes % 60).toString().padStart(2, "0");

  return `${sign}${hours}:${minutes}`;
}

function zonedDateTimeToUtc(parts: ZonedDateTimeParts, timeZone: string) {
  const target = partsAsUtc(parts);
  let candidate = target;

  // Re-evaluate the offset to handle zones whose offset changes around DST.
  for (let index = 0; index < 4; index += 1) {
    const observed = partsAsUtc(getZonedParts(new Date(candidate), timeZone));
    const correction = target - observed;
    candidate += correction;
    if (correction === 0) break;
  }

  return new Date(candidate);
}

function addCalendarDays(
  parts: Pick<ZonedDateTimeParts, "year" | "month" | "day">,
  amount: number,
) {
  const date = new Date(Date.UTC(parts.year, parts.month - 1, parts.day + amount));
  return {
    year: date.getUTCFullYear(),
    month: date.getUTCMonth() + 1,
    day: date.getUTCDate(),
  };
}

function parseDateInput(value: string | undefined) {
  if (!value) return null;
  const match = /^(\d{4})-(\d{2})-(\d{2})$/.exec(value);
  if (!match) return null;

  const year = Number(match[1]);
  const month = Number(match[2]);
  const day = Number(match[3]);
  const check = new Date(Date.UTC(year, month - 1, day));
  if (
    check.getUTCFullYear() !== year ||
    check.getUTCMonth() + 1 !== month ||
    check.getUTCDate() !== day
  ) {
    return null;
  }

  return { year, month, day };
}

export function isValidTimeZone(value: string) {
  try {
    new Intl.DateTimeFormat("en-US", { timeZone: value }).format();
    return true;
  } catch {
    return false;
  }
}

export function getTimeZoneOptions(
  currentTimeZone?: string,
  date = new Date(),
): TimeZoneOption[] {
  const timeZones = new Set<string>([
    ...Intl.supportedValuesOf("timeZone"),
    ...COMMON_TIME_ZONES,
  ]);

  if (currentTimeZone && isValidTimeZone(currentTimeZone)) {
    timeZones.add(currentTimeZone);
  }

  return Array.from(timeZones)
    .map((timeZone) => {
      const offsetMinutes = getOffsetMinutes(date, timeZone);
      const offsetLabel = formatOffset(offsetMinutes);

      return {
        value: timeZone,
        label: `(${offsetLabel}) ${timeZone}`,
        offsetLabel,
        offsetMinutes,
      };
    })
    .sort(
      (left, right) =>
        left.offsetMinutes - right.offsetMinutes ||
        left.value.localeCompare(right.value),
    );
}

/**
 * Rentang "hari" yang dimulai pada `startHour` lokal, bukan tengah malam.
 *
 * Anki memakai jam rollover (default 04:00) supaya sesi belajar lewat tengah
 * malam tetap dihitung sebagai hari yang sama. `getZonedDayRange` adalah kasus
 * khusus dengan `startHour = 0`.
 */
export function getZonedDayRangeFromHour(
  date: Date,
  timeZone: string,
  startHour: number,
) {
  const hour = Math.min(23, Math.max(0, Math.trunc(startHour)));
  const local = getZonedParts(date, timeZone);

  // Sebelum jam rollover berarti masih hari sebelumnya.
  const startDay = local.hour < hour ? addCalendarDays(local, -1) : local;
  const start = zonedDateTimeToUtc(
    { ...startDay, hour, minute: 0, second: 0, millisecond: 0 },
    timeZone,
  );
  const nextDay = addCalendarDays(startDay, 1);
  const endExclusive = zonedDateTimeToUtc(
    { ...nextDay, hour, minute: 0, second: 0, millisecond: 0 },
    timeZone,
  );

  return { start, endExclusive };
}

export function getZonedDayRange(date: Date, timeZone: string) {
  return getZonedDayRangeFromHour(date, timeZone, 0);
}

export function getZonedCalendarDate(date: Date, timeZone: string) {
  const { year, month, day } = getZonedParts(date, timeZone);
  return { year, month, day };
}

export function getUtcDateBoundary(
  value: string | undefined,
  timeZone: string,
  boundary: "start" | "end",
) {
  const date = parseDateInput(value);
  if (!date) return undefined;

  if (boundary === "start") {
    return zonedDateTimeToUtc(
      { ...date, hour: 0, minute: 0, second: 0, millisecond: 0 },
      timeZone,
    );
  }

  const nextDay = addCalendarDays(date, 1);
  return new Date(
    zonedDateTimeToUtc(
      { ...nextDay, hour: 0, minute: 0, second: 0, millisecond: 0 },
      timeZone,
    ).getTime() - 1,
  );
}

export function formatInTimeZone(
  value: Date | string,
  timeZone: string,
  options: Intl.DateTimeFormatOptions,
) {
  return new Intl.DateTimeFormat("id-ID", { ...options, timeZone }).format(new Date(value));
}
