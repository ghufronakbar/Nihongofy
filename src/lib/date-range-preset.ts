import {
  DEFAULT_TIME_ZONE,
  getUtcDateBoundary,
  getZonedCalendarDate,
} from "@/lib/time-zone";

export const DATE_RANGE_PRESETS = ["all", "thisWeek", "thisMonth", "last30Days", "custom"] as const;
export type DateRangePreset = (typeof DATE_RANGE_PRESETS)[number];

export function isDateRangePreset(value: string | undefined): value is DateRangePreset {
  return !!value && (DATE_RANGE_PRESETS as readonly string[]).includes(value);
}

// Resolusi preset -> rentang tanggal aktual, dipanggil di server (page.tsx)
// sebelum diteruskan sebagai argumen ke getAnalytics() (bukan closure) agar
// unstable_cache bisa membedakan cache key otomatis dari argumennya.
export function resolveDateRangePreset(
  preset: DateRangePreset,
  customFrom?: string,
  customTo?: string,
  timeZone = DEFAULT_TIME_ZONE,
): { from?: Date; to?: Date } {
  const now = new Date();
  const { year, month, day } = getZonedCalendarDate(now, timeZone);
  const calendarDate = new Date(Date.UTC(year, month - 1, day));
  const toDateInput = (date: Date) => date.toISOString().slice(0, 10);

  switch (preset) {
    case "all":
      return {};
    case "thisWeek": {
      const mondayOffset = (calendarDate.getUTCDay() + 6) % 7;
      calendarDate.setUTCDate(calendarDate.getUTCDate() - mondayOffset);
      return { from: getUtcDateBoundary(toDateInput(calendarDate), timeZone, "start") };
    }
    case "thisMonth":
      return {
        from: getUtcDateBoundary(
          `${String(year).padStart(4, "0")}-${String(month).padStart(2, "0")}-01`,
          timeZone,
          "start",
        ),
      };
    case "last30Days": {
      calendarDate.setUTCDate(calendarDate.getUTCDate() - 29);
      return { from: getUtcDateBoundary(toDateInput(calendarDate), timeZone, "start") };
    }
    case "custom": {
      const from = getUtcDateBoundary(customFrom, timeZone, "start");
      const to = getUtcDateBoundary(customTo, timeZone, "end");
      return { from, to };
    }
  }
}
