"use client";

import type { Ref } from "react";
import { Clock3 } from "lucide-react";
import {
  Combobox,
  ComboboxContent,
  ComboboxEmpty,
  ComboboxInput,
  ComboboxItem,
  ComboboxList,
} from "@/components/ui/combobox";
import type { TimeZoneOption } from "@/lib/time-zone";

type TimeZoneComboboxProps = {
  id: string;
  value: string;
  options: TimeZoneOption[];
  invalid: boolean;
  disabled?: boolean;
  inputRef: Ref<HTMLInputElement>;
  onBlur: () => void;
  onValueChange: (value: string) => void;
};

export function TimeZoneCombobox({
  id,
  value,
  options,
  invalid,
  disabled = false,
  inputRef,
  onBlur,
  onValueChange,
}: TimeZoneComboboxProps) {
  const selectedOption = options.find((option) => option.value === value) ?? null;

  return (
    <div className="relative">
      <Clock3
        className="pointer-events-none absolute top-1/2 left-4 z-10 size-5 -translate-y-1/2 text-black/55"
        aria-hidden="true"
      />
      <Combobox
        items={options}
        value={selectedOption}
        disabled={disabled}
        autoHighlight
        itemToStringLabel={(option) => option.label}
        itemToStringValue={(option) => option.value}
        isItemEqualToValue={(option, selected) => option.value === selected.value}
        onValueChange={(option) => {
          if (option) onValueChange(option.value);
        }}
      >
        <ComboboxInput
          id={id}
          ref={inputRef}
          autoComplete="off"
          placeholder="Cari kota, zona, atau offset..."
          aria-invalid={invalid}
          onBlur={onBlur}
          className="h-12 rounded-lg border-[3px] border-neo-ink bg-white shadow-neo-sm transition-[transform,box-shadow] focus-within:-translate-x-px focus-within:-translate-y-px focus-within:shadow-neo [&_[data-slot=input-group-control]]:pl-12 [&_[data-slot=input-group-control]]:text-base"
        />
        <ComboboxContent className="min-w-0 rounded-md border-[3px] border-neo-ink bg-white shadow-neo">
          <ComboboxEmpty className="px-4 py-6 font-semibold text-black/60">
            Timezone tidak ditemukan.
          </ComboboxEmpty>
          <ComboboxList className="max-h-72 p-1.5">
            {options.map((option, index) => (
              <ComboboxItem
                key={option.value}
                value={option}
                index={index}
                className="rounded-sm px-2.5 py-2.5 font-semibold data-highlighted:bg-neo-yellow data-highlighted:text-black"
              >
                <span className="w-16 shrink-0 font-mono text-xs font-black tabular-nums text-black/60">
                  ({option.offsetLabel})
                </span>
                <span className="min-w-0 truncate">{option.value}</span>
              </ComboboxItem>
            ))}
          </ComboboxList>
        </ComboboxContent>
      </Combobox>
    </div>
  );
}
