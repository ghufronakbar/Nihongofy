"use client";

import { useState, useTransition } from "react";
import { ArrowRight, BookOpen, Layers, Play } from "lucide-react";
import type { JlptSection } from "@prisma/client";
import { createAttemptAction } from "../actions";
import { JLPT_SECTION_LABELS } from "@/constants/jlpt";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";

export function StartAttemptActions({
  testPackageId,
  availableSections,
}: {
  testPackageId: number;
  availableSections: JlptSection[];
}) {
  const [isPending, startTransition] = useTransition();
  const [selectedSection, setSelectedSection] = useState<JlptSection | "">("");

  function handleMockTest() {
    startTransition(() => createAttemptAction({ testPackageId, sectionScope: null }));
  }

  function handleSectionPractice() {
    if (!selectedSection) return;
    startTransition(() =>
      createAttemptAction({ testPackageId, sectionScope: selectedSection }),
    );
  }

  return (
    <div className="grid gap-6 sm:grid-cols-2">
      {/* Option 1: Full Mock Test */}
      <div className="flex flex-col justify-between rounded-lg border-[3px] border-neo-ink bg-neo-paper p-5 shadow-neo-sm">
        <div>
          <div className="flex items-center gap-2">
            <span className="grid size-8 place-items-center rounded border-2 border-neo-ink bg-neo-blue text-white shadow-neo-sm">
              <BookOpen className="size-4" />
            </span>
            <span className="font-mono text-xs font-black uppercase">MODE 1</span>
          </div>
          <h4 className="mt-3 text-lg font-black">Full Mock Test Simulasi</h4>
          <p className="mt-1 text-xs font-semibold text-foreground/70 leading-relaxed">
            Kerjakan semua sesi secara berurutan sesuai alur ujian resmi JLPT.
          </p>
        </div>
        <button
          type="button"
          disabled={isPending}
          onClick={handleMockTest}
          className="neo-button mt-5 w-full bg-neo-blue text-white font-black"
        >
          <Play className="size-4 fill-white" />
          Mulai Mock Test Penuh
        </button>
      </div>

      {/* Option 2: Section Practice */}
      <div className="flex flex-col justify-between rounded-lg border-[3px] border-neo-ink bg-white p-5 shadow-neo-sm">
        <div>
          <div className="flex items-center gap-2">
            <span className="grid size-8 place-items-center rounded border-2 border-neo-ink bg-neo-yellow text-black shadow-neo-sm">
              <Layers className="size-4" />
            </span>
            <span className="font-mono text-xs font-black uppercase">MODE 2</span>
          </div>
          <h4 className="mt-3 text-lg font-black">Latihan Per Seksi</h4>
          <p className="mt-1 text-xs font-semibold text-foreground/70 leading-relaxed">
            Pilih satu seksi fokus (Kosakata/Grammar, Dokkai, atau Choukai).
          </p>
        </div>

        <div className="mt-4 space-y-3">
          <Select
            value={selectedSection}
            onValueChange={(value) => setSelectedSection(value as JlptSection)}
          >
            <SelectTrigger className="h-11 w-full rounded-lg border-2 border-neo-ink bg-white px-3 font-bold text-sm shadow-neo-sm">
              <SelectValue placeholder="-- Pilih Seksi Latihan --" />
            </SelectTrigger>
            <SelectContent className="border-2 border-neo-ink shadow-neo font-bold">
              {availableSections.map((section) => (
                <SelectItem key={section} value={section}>
                  Latihan {JLPT_SECTION_LABELS[section]}
                </SelectItem>
              ))}
            </SelectContent>
          </Select>

          <button
            type="button"
            disabled={isPending || !selectedSection}
            onClick={handleSectionPractice}
            className="neo-button w-full bg-neo-yellow text-black font-black disabled:opacity-50"
          >
            Mulai Seksi Ini
            <ArrowRight className="size-4" />
          </button>
        </div>
      </div>
    </div>
  );
}
