"use client";

import { usePathname, useRouter, useSearchParams } from "next/navigation";
import { CalendarIcon, Filter } from "lucide-react";
import type { DateRange } from "react-day-picker";
import type { JlptSection } from "@prisma/client";
import { Calendar } from "@/components/ui/calendar";
import { Popover, PopoverContent, PopoverTrigger } from "@/components/ui/popover";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { JLPT_SECTION_LABELS } from "@/constants/jlpt";
import { DATE_RANGE_PRESETS, type DateRangePreset } from "@/lib/date-range-preset";

const SCOPE_OPTIONS: { value: string; label: string }[] = [
  { value: "ALL", label: "Semua Aktivitas" },
  { value: "MOCK", label: "Mock Test" },
  { value: "PRACTICE", label: "Latihan Cepat" },
  ...(Object.keys(JLPT_SECTION_LABELS) as JlptSection[]).map((section) => ({
    value: section,
    label: `Latihan ${JLPT_SECTION_LABELS[section]}`,
  })),
];

const RANGE_LABELS: Record<DateRangePreset, string> = {
  all: "Semua Waktu",
  thisWeek: "Minggu Ini",
  thisMonth: "Bulan Ini",
  last30Days: "30 Hari Terakhir",
  custom: "Custom Range",
};

function toIsoDate(date: Date): string {
  return date.toISOString().slice(0, 10);
}

export function AnalyticsFilterBar() {
  const router = useRouter();
  const pathname = usePathname();
  const searchParams = useSearchParams();

  const scope = searchParams.get("scope") ?? "ALL";
  const range = searchParams.get("range") ?? "all";
  const from = searchParams.get("from") ?? undefined;
  const to = searchParams.get("to") ?? undefined;

  function pushParams(mutate: (params: URLSearchParams) => void) {
    const params = new URLSearchParams(searchParams.toString());
    mutate(params);
    router.push(`${pathname}?${params.toString()}`);
  }

  function handleScopeChange(value: string | null) {
    pushParams((params) => {
      if (!value || value === "ALL") params.delete("scope");
      else params.set("scope", value);
    });
  }

  function handleRangeChange(value: string | null) {
    pushParams((params) => {
      if (!value || value === "all") {
        params.delete("range");
        params.delete("from");
        params.delete("to");
      } else {
        params.set("range", value);
        if (value !== "custom") {
          params.delete("from");
          params.delete("to");
        }
      }
    });
  }

  function handleCustomRangeSelect(selected: DateRange | undefined) {
    if (!selected?.from) return;
    pushParams((params) => {
      params.set("range", "custom");
      params.set("from", toIsoDate(selected.from!));
      if (selected.to) params.set("to", toIsoDate(selected.to));
      else params.delete("to");
    });
  }

  return (
    <div className="neo-surface bg-white p-4 border-[3px] border-neo-ink shadow-neo flex flex-wrap items-center gap-3">
      <div className="flex items-center gap-2 mr-2 font-mono text-xs font-black uppercase text-neo-ink">
        <Filter className="size-4" strokeWidth={2.5} />
        Filter Data:
      </div>

      <div className="flex flex-wrap items-center gap-2.5">
        <Select value={scope} onValueChange={handleScopeChange}>
          <SelectTrigger className="h-10 w-56 rounded-md border-2 border-neo-ink bg-white px-3 font-bold text-xs shadow-neo-sm">
            <SelectValue />
          </SelectTrigger>
          <SelectContent className="border-2 border-neo-ink shadow-neo font-bold text-xs">
            {SCOPE_OPTIONS.map((option) => (
              <SelectItem key={option.value} value={option.value}>
                {option.label}
              </SelectItem>
            ))}
          </SelectContent>
        </Select>

        <Select value={range} onValueChange={handleRangeChange}>
          <SelectTrigger className="h-10 w-44 rounded-md border-2 border-neo-ink bg-white px-3 font-bold text-xs shadow-neo-sm">
            <SelectValue />
          </SelectTrigger>
          <SelectContent className="border-2 border-neo-ink shadow-neo font-bold text-xs">
            {DATE_RANGE_PRESETS.map((preset) => (
              <SelectItem key={preset} value={preset}>
                {RANGE_LABELS[preset]}
              </SelectItem>
            ))}
          </SelectContent>
        </Select>

        {range === "custom" && (
          <Popover>
            <PopoverTrigger
              render={
                <button
                  type="button"
                  className="neo-button !min-h-10 !px-3.5 !py-1.5 bg-neo-yellow text-black text-xs font-black"
                />
              }
            >
              <CalendarIcon className="size-3.5" />
              {from ? `${from} - ${to ?? "..."}` : "Pilih Rentang Tanggal"}
            </PopoverTrigger>
            <PopoverContent className="w-auto p-0 border-2 border-neo-ink shadow-neo" align="start">
              <Calendar
                mode="range"
                numberOfMonths={2}
                selected={{
                  from: from ? new Date(from) : undefined,
                  to: to ? new Date(to) : undefined,
                }}
                onSelect={handleCustomRangeSelect}
              />
            </PopoverContent>
          </Popover>
        )}
      </div>
    </div>
  );
}
