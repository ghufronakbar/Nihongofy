"use client";

import { useState, useTransition } from "react";
import { RefreshCw } from "lucide-react";
import { invalidateCacheTagAction, type OpsActionResult } from "../actions";
import type { InvalidatableTag } from "../cache-tags";

export function CacheInvalidator({ tags }: { tags: { key: InvalidatableTag; value: string }[] }) {
  const [isPending, startTransition] = useTransition();
  const [notice, setNotice] = useState<OpsActionResult | null>(null);

  return (
    <div className="flex flex-col gap-3">
      <div className="flex flex-wrap gap-2">
        {tags.map((tag) => (
          <button
            key={tag.key}
            type="button"
            disabled={isPending}
            onClick={() => {
              setNotice(null);
              startTransition(async () => {
                setNotice(await invalidateCacheTagAction({ tag: tag.key }));
              });
            }}
            className="neo-button bg-white text-xs font-extrabold text-black"
          >
            <RefreshCw className="size-3.5" />
            {tag.value}
          </button>
        ))}
      </div>
      {notice && (
        <p
          className={`text-xs font-bold ${notice.ok ? "text-foreground/70" : "text-neo-coral"}`}
        >
          {notice.message}
        </p>
      )}
    </div>
  );
}
