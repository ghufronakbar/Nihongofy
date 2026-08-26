"use client";

import { useState } from "react";
import { Eye, EyeOff, LockKeyhole } from "lucide-react";
import { Input } from "@/components/ui/input";
import { cn } from "@/lib/utils";

export function PasswordInput({
  className,
  ...props
}: Omit<React.ComponentProps<typeof Input>, "type">) {
  const [isVisible, setIsVisible] = useState(false);

  return (
    <div className="relative">
      <LockKeyhole
        className="pointer-events-none absolute top-1/2 left-4 z-10 size-5 -translate-y-1/2 text-black/55"
        aria-hidden="true"
      />
      <Input
        type={isVisible ? "text" : "password"}
        className={cn("neo-input h-12 pr-12 pl-12", className)}
        {...props}
      />
      <button
        type="button"
        onClick={() => setIsVisible((value) => !value)}
        className="absolute top-1/2 right-2 grid size-9 -translate-y-1/2 place-items-center rounded-sm text-black transition-colors hover:bg-neo-yellow focus-visible:outline-offset-0"
        aria-label={isVisible ? "Sembunyikan password" : "Tampilkan password"}
        aria-pressed={isVisible}
      >
        {isVisible ? (
          <EyeOff className="size-5" aria-hidden="true" />
        ) : (
          <Eye className="size-5" aria-hidden="true" />
        )}
      </button>
    </div>
  );
}
