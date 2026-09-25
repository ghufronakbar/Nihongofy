"use server";

import { updateTag } from "next/cache";
import { z } from "zod";
import { requireAdmin } from "@/lib/auth";
import { recordAdminAction } from "../audit";
import { INVALIDATABLE_TAGS, type InvalidatableTag } from "./cache-tags";

const InvalidateCacheSchema = z.object({
  tag: z.enum(Object.keys(INVALIDATABLE_TAGS) as [InvalidatableTag, ...InvalidatableTag[]]),
});

type InvalidateCacheInput = z.infer<typeof InvalidateCacheSchema>;
export type OpsActionResult = { ok: true; message: string } | { ok: false; message: string };

export async function invalidateCacheTagAction(
  input: InvalidateCacheInput,
): Promise<OpsActionResult> {
  const actor = await requireAdmin();

  const validated = InvalidateCacheSchema.safeParse(input);
  if (!validated.success) return { ok: false, message: "Tag tidak dikenal." };

  const tag = INVALIDATABLE_TAGS[validated.data.tag];
  updateTag(tag);

  await recordAdminAction({
    actor,
    action: "ops.cache_invalidate",
    targetType: "cache-tag",
    targetId: validated.data.tag,
    summary: `Menginvalidasi tag cache "${tag}" secara manual.`,
  });

  return { ok: true, message: `Tag "${tag}" diinvalidasi.` };
}
