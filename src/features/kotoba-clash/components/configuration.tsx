"use client";

import { useForm, useWatch } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import { Button } from "@/components/ui/button";
import { Checkbox } from "@/components/ui/checkbox";
import { JLPT_SECTION_LABELS, MONDAI_TYPE_TRANSLATIONS } from "@/constants/jlpt";
import { ClashConfigSchema, type ClashConfig } from "../schemas";
import { CLASH_CATEGORIES, CLASH_LEVELS, CLASH_QUESTION_COUNTS, type ClashMondaiType } from "../domain/rules";
import type { ClashCatalogEntry } from "../server/catalog";

export function ClashConfiguration({ config, catalog, disabled, save }: {
  config: ClashConfig | null; catalog: ClashCatalogEntry[]; disabled: boolean; save: (config: ClashConfig) => Promise<void>;
}) {
  const level = CLASH_LEVELS.find((candidate) => catalog.filter((row) => row.jlptLevel === candidate).reduce((n, row) => n + row.count, 0) >= 5) ?? "N5";
  const defaults: ClashConfig = config ?? {
    jlptLevel: level, mondaiTypes: catalog.filter((row) => row.jlptLevel === level && row.count > 0).map((row) => row.mondaiType), questionCount: 5,
  };
  const form = useForm<ClashConfig>({ resolver: zodResolver(ClashConfigSchema), defaultValues: defaults });
  const selectedLevel = useWatch({ control: form.control, name: "jlptLevel" });
  const selectedTypes = useWatch({ control: form.control, name: "mondaiTypes" });
  const stock = (type: ClashMondaiType) => catalog.find((row) => row.jlptLevel === selectedLevel && row.mondaiType === type)?.count ?? 0;
  const total = selectedTypes.reduce((count, type) => count + stock(type), 0);
  const toggle = (types: ClashMondaiType[], checked: boolean) => form.setValue("mondaiTypes", checked ? [...new Set([...selectedTypes, ...types])] : selectedTypes.filter((type) => !types.includes(type)), { shouldDirty: true, shouldValidate: true });
  return (
    <form className="space-y-6" onSubmit={form.handleSubmit(save)}>
      <fieldset disabled={disabled || form.formState.isSubmitting} className="space-y-6 disabled:opacity-70">
        <div className="grid grid-cols-2 gap-5">
          <label className="space-y-2 text-sm font-bold">Level JLPT
            <select className="mt-2 block min-h-11 w-full border-2 border-neo-ink bg-white p-2" {...form.register("jlptLevel", { onChange: () => form.setValue("mondaiTypes", [], { shouldDirty: true }) })}>
              {CLASH_LEVELS.map((value) => <option key={value} value={value}>{value}</option>)}
            </select>
          </label>
          <label className="space-y-2 text-sm font-bold">Jumlah soal
            <select className="mt-2 block min-h-11 w-full border-2 border-neo-ink bg-white p-2" {...form.register("questionCount", { valueAsNumber: true })}>
              {CLASH_QUESTION_COUNTS.map((value) => <option key={value} value={value} disabled={value > total}>{value} soal{value > total ? " (stok kurang)" : ""}</option>)}
            </select>
          </label>
        </div>
        <div className="space-y-5">
          {Object.entries(CLASH_CATEGORIES).map(([category, types]) => {
            const available = types.filter((type) => stock(type) > 0);
            const checkedCount = available.filter((type) => selectedTypes.includes(type)).length;
            return <fieldset key={category} className="border-l-[3px] border-neo-ink pl-4">
              <legend className="mb-3 pr-2">
                <label className="flex cursor-pointer items-center gap-3 font-black">
                  <Checkbox checked={available.length > 0 && checkedCount === available.length} indeterminate={checkedCount > 0 && checkedCount < available.length} disabled={available.length === 0} onCheckedChange={(checked) => toggle(available, checked)} />
                  {JLPT_SECTION_LABELS[category as keyof typeof CLASH_CATEGORIES]}
                </label>
              </legend>
              <div className="grid gap-3 sm:grid-cols-2">
                {types.map((type) => <label key={type} className="flex min-h-9 cursor-pointer items-start gap-3 text-sm has-disabled:cursor-default has-disabled:opacity-50">
                  <Checkbox className="mt-1" checked={selectedTypes.includes(type)} disabled={stock(type) === 0} onCheckedChange={(checked) => toggle([type], checked)} />
                  <span>{MONDAI_TYPE_TRANSLATIONS[type]}<span className="block text-xs text-foreground/65">{stock(type) > 0 ? `${stock(type)} soal tersedia` : "Belum tersedia untuk level ini"}</span></span>
                </label>)}
              </div>
            </fieldset>;
          })}
        </div>
        <p className="text-sm text-foreground/70">Choukai belum tersedia. {total} soal teks sesuai pilihan. Jika tipe melebihi jumlah soal, sebagian tipe mungkin tidak muncul.</p>
        {Object.keys(form.formState.errors).length > 0 && <p role="alert" className="text-sm font-bold">Pilih level, minimal satu tipe soal, dan jumlah soal yang tersedia.</p>}
        <Button type="submit" disabled={total < form.getValues("questionCount")} className="neo-button h-auto bg-neo-yellow py-3 text-neo-ink">{form.formState.isSubmitting ? "Menyimpan..." : "Simpan pengaturan"}</Button>
      </fieldset>
    </form>
  );
}
