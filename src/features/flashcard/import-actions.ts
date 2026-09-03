"use server";

import { revalidatePath } from "next/cache";
import type { Prisma } from "@prisma/client";
import { z } from "zod";
import { getSession } from "@/lib/auth";
import { prisma } from "@/lib/prisma";
import { ensureCollection, ensureDeckPath, ensureDefaultPreset } from "./lib/collection";
import {
  FLASHCARD_IMPORT_CHUNK_SIZE,
  IMPORT_MODES,
  resolveImportGuid,
} from "./lib/import/mapping";
import { FLASHCARD_NOTE_TYPE_KINDS, countCardsForNote } from "./note-types";

/**
 * Impor CSV/TXT.
 *
 * File di-parse dan dipetakan di BROWSER, lalu dikirim ke sini per batch. Alasannya
 * bukan batas 4,5 MB Vercel — CSV sebesar itu setara puluhan ribu baris dan hampir
 * tak pernah tercapai — melainkan supaya ada progres nyata, user bisa memperbaiki
 * pemetaan sebelum satu baris pun masuk database, dan tidak ada satu request pun
 * yang mendekati batas durasi.
 */


const ImportRowSchema = z.object({
  guid: z.string().trim().max(64).nullable(),
  fields: z.array(z.string().max(10_000)).min(1).max(12),
  tags: z.array(z.string().trim().min(1).max(64)).max(32),
  deckName: z
    .string()
    .trim()
    .min(1)
    .max(500)
    .refine((value) => value.split("::").every((part) => part.trim().length > 0)),
  checksum: z.number().int(),
});

const ChunkSchema = z.object({
  jobId: z.string().uuid(),
  noteType: z.enum(FLASHCARD_NOTE_TYPE_KINDS as [string, ...string[]]),
  mode: z.enum(IMPORT_MODES),
  rows: z.array(ImportRowSchema).min(1).max(FLASHCARD_IMPORT_CHUNK_SIZE),
});

export type ImportStats = {
  added: number;
  updated: number;
  skipped: number;
  cards: number;
};

type ActionResult<T = undefined> =
  | ({ ok: true } & (T extends undefined ? { data?: undefined } : { data: T }))
  | { ok: false; message: string };

export async function createImportJobAction(input: {
  fileName: string;
  totalRows: number;
}): Promise<ActionResult<{ jobId: string }>> {
  const session = await getSession();
  if (!session) return { ok: false, message: "Masuk dulu untuk mengimpor." };

  const parsed = z
    .object({
      fileName: z.string().trim().min(1).max(255),
      totalRows: z.number().int().min(1).max(200_000),
    })
    .safeParse(input);
  if (!parsed.success) return { ok: false, message: "Data impor tidak valid." };

  await ensureCollection(session.userId);

  const job = await prisma.flashcardImportJob.create({
    data: {
      userId: session.userId,
      status: "IMPORTING",
      fileName: parsed.data.fileName,
      totalRows: parsed.data.totalRows,
      stats: { added: 0, updated: 0, skipped: 0, cards: 0 } satisfies ImportStats,
    },
    select: { id: true },
  });

  return { ok: true, data: { jobId: job.id } };
}

/**
 * Menyimpan satu batch.
 *
 * Dedup mengikuti Anki: `guid` bila ada (persisten walau field pertama diedit),
 * kalau tidak lewat field sort dalam note type yang sama. Mode `update` MEMPERTAHANKAN
 * jadwal kartu — hanya isi note yang diperbarui, karena itulah yang membuat impor
 * ulang deck yang diperbarui tidak menghanguskan progres belajar.
 */
export async function importChunkAction(input: {
  jobId: string;
  noteType: string;
  mode: string;
  rows: unknown[];
}): Promise<ActionResult<ImportStats>> {
  const session = await getSession();
  if (!session) return { ok: false, message: "Masuk dulu." };

  const parsed = ChunkSchema.safeParse(input);
  if (!parsed.success) {
    return { ok: false, message: parsed.error.issues[0]?.message ?? "Batch tidak valid." };
  }

  const { jobId, mode, rows } = parsed.data;
  const noteType = parsed.data.noteType as Parameters<typeof countCardsForNote>[0];

  const job = await prisma.flashcardImportJob.findFirst({
    where: { id: jobId, userId: session.userId },
    select: { id: true, doneRows: true, stats: true },
  });
  if (!job) return { ok: false, message: "Job impor tidak ditemukan." };

  const preset = await ensureDefaultPreset(session.userId);

  // Deck dibuat sekali per batch, bukan per baris.
  const deckIds = new Map<string, number>();
  for (const deckName of new Set(rows.map((row) => row.deckName))) {
    deckIds.set(
      deckName,
      await ensureDeckPath(session.userId, deckName, preset.id, {
        sourceKind: "IMPORTED",
        sourceRef: jobId,
      }),
    );
  }

  // Satu query untuk seluruh batch, bukan satu per baris.
  const guids = rows.map((row) => row.guid).filter((guid): guid is string => guid !== null);
  const checksums = rows.filter((row) => row.guid === null).map((row) => row.checksum);

  const existing =
    mode === "importAsNew"
      ? []
      : await prisma.flashcardNote.findMany({
          where: {
            userId: session.userId,
            OR: [
              ...(guids.length > 0 ? [{ guid: { in: guids } }] : []),
              ...(checksums.length > 0
                ? [{ noteType, checksum: { in: checksums } }]
                : []),
            ],
          },
          select: { id: true, guid: true, noteType: true, checksum: true, fields: true },
        });

  const byGuid = new Map(existing.map((note) => [note.guid, note]));
  const byChecksum = new Map(
    existing
      .filter((note) => note.noteType === noteType)
      .map((note) => [note.checksum, note]),
  );

  const stats: ImportStats = { added: 0, updated: 0, skipped: 0, cards: 0 };
  // Guid yang sudah dipakai, baik oleh note lama maupun oleh baris sebelumnya
  // dalam batch ini.
  const claimedGuids = new Set(existing.map((note) => note.guid));
  let stamp = Date.now();
  const nextId = () => BigInt(stamp++);

  const newNotes: Prisma.FlashcardNoteCreateManyInput[] = [];
  const newCards: Prisma.FlashcardCardCreateManyInput[] = [];
  const updates: Prisma.PrismaPromise<unknown>[] = [];

  for (const [index, row] of rows.entries()) {
    const match = row.guid ? byGuid.get(row.guid) : byChecksum.get(row.checksum);

    if (match && mode !== "importAsNew") {
      if (mode === "ignoreDuplicates") {
        stats.skipped += 1;
        continue;
      }
      // mode "update": isi note diperbarui, jadwal kartunya tidak disentuh.
      updates.push(
        prisma.flashcardNote.update({
          where: { id: match.id },
          data: { fields: row.fields, tags: row.tags, checksum: row.checksum },
        }),
      );
      stats.updated += 1;
      continue;
    }

    const guid = resolveImportGuid(mode, row.guid, jobId, job.doneRows + index);

    // Guid yang bentrok di dalam satu batch akan membuat note-nya dilewati
    // sementara kartunya tetap dibuat, dan itu berujung pelanggaran foreign key.
    // Lebih baik dilaporkan sebagai dilewati.
    if (claimedGuids.has(guid)) {
      stats.skipped += 1;
      continue;
    }
    claimedGuids.add(guid);

    const noteId = nextId();

    newNotes.push({
      id: noteId,
      userId: session.userId,
      noteType,
      guid,
      fields: row.fields,
      tags: row.tags,
      checksum: row.checksum,
    });

    const cardCount = countCardsForNote(noteType, row.fields);
    const deckId = deckIds.get(row.deckName)!;
    for (let ord = 0; ord < cardCount; ord += 1) {
      newCards.push({
        id: nextId(),
        userId: session.userId,
        noteId,
        deckId,
        ord,
        due: new Date(),
        position: job.doneRows + index,
      });
    }
    stats.added += 1;
    stats.cards += cardCount;
  }

  try {
    await prisma.$transaction([
      ...updates,
      ...(newNotes.length > 0
        ? [prisma.flashcardNote.createMany({ data: newNotes })]
        : []),
      ...(newCards.length > 0
        ? [prisma.flashcardCard.createMany({ data: newCards })]
        : []),
    ]);
  } catch (error) {
    await prisma.flashcardImportJob.update({
      where: { id: jobId },
      data: { status: "FAILED", error: String(error).slice(0, 500) },
    });
    return { ok: false, message: "Gagal menyimpan batch. Impor dihentikan." };
  }

  const previous = (job.stats ?? {}) as Partial<ImportStats>;
  const merged: ImportStats = {
    added: (previous.added ?? 0) + stats.added,
    updated: (previous.updated ?? 0) + stats.updated,
    skipped: (previous.skipped ?? 0) + stats.skipped,
    cards: (previous.cards ?? 0) + stats.cards,
  };

  await prisma.flashcardImportJob.update({
    where: { id: jobId },
    data: { doneRows: job.doneRows + rows.length, stats: merged },
  });

  return { ok: true, data: merged };
}

export async function finishImportJobAction(input: {
  jobId: string;
  problemCount: number;
}): Promise<ActionResult<ImportStats>> {
  const session = await getSession();
  if (!session) return { ok: false, message: "Masuk dulu." };

  const parsed = z
    .object({ jobId: z.string().uuid(), problemCount: z.number().int().min(0) })
    .safeParse(input);
  if (!parsed.success) return { ok: false, message: "Job tidak valid." };

  const job = await prisma.flashcardImportJob.findFirst({
    where: { id: parsed.data.jobId, userId: session.userId },
    select: { id: true, stats: true },
  });
  if (!job) return { ok: false, message: "Job impor tidak ditemukan." };

  const stats = (job.stats ?? {}) as ImportStats;
  const merged: ImportStats = {
    added: stats.added ?? 0,
    updated: stats.updated ?? 0,
    skipped: (stats.skipped ?? 0) + parsed.data.problemCount,
    cards: stats.cards ?? 0,
  };

  await prisma.flashcardImportJob.update({
    where: { id: job.id },
    data: { status: "DONE", stats: merged },
  });

  revalidatePath("/flashcard");
  return { ok: true, data: merged };
}
