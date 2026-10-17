"use client";

import { useForm, useWatch } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import { Check, Save, Layers3 } from "lucide-react";
import { Checkbox } from "@/components/ui/checkbox";
import { JLPT_SECTION_LABELS, MONDAI_TYPE_TRANSLATIONS } from "@/constants/jlpt";
import { ClashConfigSchema, type ClashConfig } from "../schemas";
import { CLASH_CATEGORIES, CLASH_LEVELS, CLASH_QUESTION_COUNTS, type ClashMondaiType } from "../domain/rules";
import type { ClashCatalogEntry } from "../server/catalog";
import { ClashButton } from "./arena-ui";

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
  const questionCount = useWatch({ control: form.control, name: "questionCount" });
  const stock = (type: ClashMondaiType) => catalog.find((row) => row.jlptLevel === selectedLevel && row.mondaiType === type)?.count ?? 0;
  const total = selectedTypes.reduce((count, type) => count + stock(type), 0);
  const toggle = (types: ClashMondaiType[], checked: boolean) => form.setValue("mondaiTypes", checked ? [...new Set([...selectedTypes, ...types])] : selectedTypes.filter((type) => !types.includes(type)), { shouldDirty: true, shouldValidate: true });
  return (
    <form className="space-y-6" onSubmit={form.handleSubmit(save)}>
      <fieldset disabled={disabled || form.formState.isSubmitting} className="space-y-6 disabled:opacity-70">
        <div className="grid grid-cols-2 gap-4">
          <label className="space-y-2 text-sm font-extrabold">Level JLPT
            <select className="clash-select mt-2 block" {...form.register("jlptLevel", { onChange: () => form.setValue("mondaiTypes", [], { shouldDirty: true }) })}>
              {CLASH_LEVELS.map((value) => <option key={value} value={value}>{value}</option>)}
            </select>
          </label>
          <label className="space-y-2 text-sm font-extrabold">Jumlah soal
            <select className="clash-select mt-2 block" {...form.register("questionCount", { valueAsNumber: true })}>
              {CLASH_QUESTION_COUNTS.map((value) => <option key={value} value={value} disabled={value > total}>{value} soal{value > total ? " (stok kurang)" : ""}</option>)}
            </select>
          </label>
        </div>
        <div className="flex items-center gap-2 border-b-2 border-neo-ink pb-3"><Layers3 className="size-4" /><h3 className="text-sm font-extrabold">Pilih medan tanding</h3><span className="ml-auto font-mono text-xs font-bold">{selectedTypes.length} tipe</span></div>
        <div className="space-y-5">
          {Object.entries(CLASH_CATEGORIES).map(([category, types]) => {
            const available = types.filter((type) => stock(type) > 0);
            const checkedCount = available.filter((type) => selectedTypes.includes(type)).length;
            return <fieldset key={category} className="clash-category">
              <legend className="mb-3 pr-2">
                <label className="flex cursor-pointer items-center gap-3 font-black">
                  <Checkbox className="clash-check" checked={available.length > 0 && checkedCount === available.length} indeterminate={checkedCount > 0 && checkedCount < available.length} disabled={available.length === 0} onCheckedChange={(checked) => toggle(available, checked)} />
                  {JLPT_SECTION_LABELS[category as keyof typeof CLASH_CATEGORIES]}
                </label>
              </legend>
              <div className="grid gap-1 sm:grid-cols-2">
                {types.map((type) => <label key={type} className="clash-type text-sm">
                  <Checkbox className="clash-check mt-0.5" checked={selectedTypes.includes(type)} disabled={stock(type) === 0} onCheckedChange={(checked) => toggle([type], checked)} />
                  <span className="font-semibold">{MONDAI_TYPE_TRANSLATIONS[type]}<span className="mt-1 block text-xs font-normal text-neo-ink/60">{stock(type) > 0 ? `${stock(type)} soal tersedia` : "Belum tersedia di level ini"}</span></span>
                </label>)}
              </div>
            </fieldset>;
          })}
        </div>
        <div className="flex items-start gap-3 border-2 border-neo-ink bg-neo-paper p-4"><Check className="mt-0.5 size-5 shrink-0" /><div><p className="text-sm font-extrabold">{total} soal tersedia untuk tantangan ini</p><p className="mt-1 text-xs leading-5 text-neo-ink/65">Soal teks saja. Choukai menyusul. Jika tipe melebihi jumlah soal, sebagian tipe mungkin tidak muncul.</p></div></div>
        {Object.keys(form.formState.errors).length > 0 && <p role="alert" className="text-sm font-bold">Pilih level, minimal satu tipe soal, dan jumlah soal yang tersedia.</p>}
        <div className="flex flex-wrap items-center gap-4"><ClashButton type="submit" tone="yellow" disabled={total < questionCount}><Save className="size-4" />{form.formState.isSubmitting ? "Menyimpan..." : "Simpan pengaturan"}</ClashButton><p className="text-xs font-semibold text-neo-ink/65">{form.formState.isDirty ? "Ada perubahan yang belum disimpan." : config ? "Pengaturan tersimpan. Saatnya ready." : "Simpan dulu, lalu semua bisa ready."}</p></div>
      </fieldset>
    </form>
  );
}
