"use server";

import { notFound, redirect } from "next/navigation";
import { updateTag } from "next/cache";
import { prisma } from "@/lib/prisma";
import { requireAdmin } from "@/lib/auth";
import { CACHE_TAGS } from "@/constants/cache-key";
import { recordAdminActionTx } from "../audit";
import { buildDeckFixture } from "./queries";
import {
  CreateSystemDeckSchema,
  UpdateSystemDeckSchema,
  SetSystemDeckPublishedSchema,
  DeleteSystemDeckSchema,
  ExportSystemDeckSchema,
  CreateSystemNoteSchema,
  UpdateSystemNoteSchema,
  DeleteSystemNoteSchema,
  validateNoteFields,
  type CreateSystemDeckInput,
  type UpdateSystemDeckInput,
  type SetSystemDeckPublishedInput,
  type DeleteSystemDeckInput,
  type ExportSystemDeckInput,
  type CreateSystemNoteInput,
  type UpdateSystemNoteInput,
  type DeleteSystemNoteInput,
} from "./schemas";

export type DeckActionResult = { ok: true; message?: string } | { ok: false; message: string };

// Katalog deck bawaan dibaca halaman "Tambah deck" lewat satu tag global.
function revalidateCatalog() {
  updateTag(CACHE_TAGS.flashcardSystemCatalog);
}

export async function createSystemDeckAction(
  input: CreateSystemDeckInput,
): Promise<DeckActionResult> {
  const actor = await requireAdmin();

  const validated = CreateSystemDeckSchema.safeParse(input);
  if (!validated.success) {
    return { ok: false, message: validated.error.issues[0]?.message ?? "Data tidak valid." };
  }

  const data = validated.data;
  const clash = await prisma.flashcardSystemDeck.findUnique({
    where: { slug: data.slug },
    select: { id: true },
  });
  if (clash) return { ok: false, message: "Slug sudah dipakai deck lain." };

  await prisma.$transaction(async (tx) => {
    const deck = await tx.flashcardSystemDeck.create({ data, select: { id: true } });
    await recordAdminActionTx(tx, {
      actor,
      action: "system-deck.create",
      targetType: "system-deck",
      targetId: deck.id,
      summary: `Membuat deck bawaan "${data.name}" (${data.slug}, ${data.noteType}).`,
    });
  });

  revalidateCatalog();
  redirect("/admin/flashcard-deck");
}

export async function updateSystemDeckAction(
  input: UpdateSystemDeckInput,
): Promise<DeckActionResult> {
  const actor = await requireAdmin();

  const validated = UpdateSystemDeckSchema.safeParse(input);
  if (!validated.success) {
    return { ok: false, message: validated.error.issues[0]?.message ?? "Data tidak valid." };
  }

  const { id, ...data } = validated.data;
  const current = await prisma.flashcardSystemDeck.findUnique({
    where: { id },
    select: { slug: true, noteType: true, _count: { select: { notes: true } } },
  });
  if (!current) notFound();

  if (data.slug !== current.slug) {
    const clash = await prisma.flashcardSystemDeck.findUnique({
      where: { slug: data.slug },
      select: { id: true },
    });
    if (clash) return { ok: false, message: "Slug sudah dipakai deck lain." };
  }

  // Note type menentukan jumlah dan arti setiap field. Mengubahnya pada deck
  // yang sudah berisi note akan membuat field lama salah tafsir — kosongkan
  // notenya dulu, atau buat deck baru.
  if (data.noteType !== current.noteType && current._count.notes > 0) {
    return {
      ok: false,
      message: `Tidak dapat mengubah note type selama deck masih berisi ${current._count.notes} note: jumlah dan arti field-nya berbeda.`,
    };
  }

  await prisma.$transaction(async (tx) => {
    await tx.flashcardSystemDeck.update({ where: { id }, data });
    await recordAdminActionTx(tx, {
      actor,
      action: "system-deck.update",
      targetType: "system-deck",
      targetId: id,
      summary:
        `Menyunting deck bawaan ${data.slug}` +
        (data.slug !== current.slug ? ` (sebelumnya ${current.slug}).` : "."),
    });
  });

  revalidateCatalog();
  redirect("/admin/flashcard-deck");
}

export async function setSystemDeckPublishedAction(
  input: SetSystemDeckPublishedInput,
): Promise<DeckActionResult> {
  const actor = await requireAdmin();

  const validated = SetSystemDeckPublishedSchema.safeParse(input);
  if (!validated.success) return { ok: false, message: "Data tidak valid." };

  const { id, isPublished } = validated.data;
  const deck = await prisma.flashcardSystemDeck.findUnique({
    where: { id },
    select: { slug: true },
  });
  if (!deck) notFound();

  await prisma.$transaction(async (tx) => {
    await tx.flashcardSystemDeck.update({ where: { id }, data: { isPublished } });
    await recordAdminActionTx(tx, {
      actor,
      action: "system-deck.publish",
      targetType: "system-deck",
      targetId: id,
      summary: `${isPublished ? "Menampilkan" : "Menyembunyikan"} deck bawaan ${deck.slug} di katalog.`,
    });
  });

  revalidateCatalog();
  return { ok: true };
}

/**
 * Menghapus deck dari katalog. Koleksi user tidak terpengaruh: isi deck bawaan
 * DISALIN saat user menambahkannya, jadi kartu mereka berdiri sendiri.
 */
export async function deleteSystemDeckAction(
  input: DeleteSystemDeckInput,
): Promise<DeckActionResult> {
  const actor = await requireAdmin();

  const validated = DeleteSystemDeckSchema.safeParse(input);
  if (!validated.success) return { ok: false, message: "Data tidak valid." };

  const deck = await prisma.flashcardSystemDeck.findUnique({
    where: { id: validated.data.id },
    select: { slug: true, _count: { select: { notes: true } } },
  });
  if (!deck) notFound();
  if (validated.data.confirmSlug !== deck.slug) {
    return { ok: false, message: "Slug tidak cocok. Penghapusan dibatalkan." };
  }

  await prisma.$transaction(async (tx) => {
    await tx.flashcardSystemDeck.delete({ where: { id: validated.data.id } });
    await recordAdminActionTx(tx, {
      actor,
      action: "system-deck.delete",
      targetType: "system-deck",
      targetId: validated.data.id,
      summary: `Menghapus deck bawaan ${deck.slug} (${deck._count.notes} note) dari katalog.`,
    });
  });

  revalidateCatalog();
  return { ok: true };
}

export async function createSystemNoteAction(
  input: CreateSystemNoteInput,
): Promise<DeckActionResult> {
  const actor = await requireAdmin();

  const validated = CreateSystemNoteSchema.safeParse(input);
  if (!validated.success) {
    return { ok: false, message: validated.error.issues[0]?.message ?? "Data tidak valid." };
  }

  const data = validated.data;
  const deck = await prisma.flashcardSystemDeck.findUnique({
    where: { id: data.deckId },
    select: { slug: true, noteType: true },
  });
  if (!deck) notFound();

  const fieldError = validateNoteFields(deck.noteType, data.fields);
  if (fieldError) return { ok: false, message: fieldError };

  const clash = await prisma.flashcardSystemNote.findFirst({
    where: { deckId: data.deckId, guid: data.guid },
    select: { id: true },
  });
  if (clash) return { ok: false, message: "guid sudah dipakai note lain dalam deck ini." };

  await prisma.$transaction(async (tx) => {
    const note = await tx.flashcardSystemNote.create({
      data: {
        deckId: data.deckId,
        guid: data.guid,
        fields: data.fields,
        tags: data.tags,
        order: data.order,
      },
      select: { id: true },
    });
    await recordAdminActionTx(tx, {
      actor,
      action: "system-note.create",
      targetType: "system-note",
      targetId: note.id,
      summary: `Menambah note ${data.guid} pada deck bawaan ${deck.slug}.`,
    });
  });

  revalidateCatalog();
  return { ok: true, message: "Note ditambahkan." };
}

/** `guid` tidak termasuk yang dapat diubah — lihat catatan di schemas.ts. */
export async function updateSystemNoteAction(
  input: UpdateSystemNoteInput,
): Promise<DeckActionResult> {
  const actor = await requireAdmin();

  const validated = UpdateSystemNoteSchema.safeParse(input);
  if (!validated.success) {
    return { ok: false, message: validated.error.issues[0]?.message ?? "Data tidak valid." };
  }

  const data = validated.data;
  const note = await prisma.flashcardSystemNote.findUnique({
    where: { id: data.id },
    select: { guid: true, deck: { select: { slug: true, noteType: true } } },
  });
  if (!note) notFound();

  const fieldError = validateNoteFields(note.deck.noteType, data.fields);
  if (fieldError) return { ok: false, message: fieldError };

  await prisma.$transaction(async (tx) => {
    await tx.flashcardSystemNote.update({
      where: { id: data.id },
      data: { fields: data.fields, tags: data.tags, order: data.order },
    });
    await recordAdminActionTx(tx, {
      actor,
      action: "system-note.update",
      targetType: "system-note",
      targetId: data.id,
      summary: `Menyunting note ${note.guid} pada deck bawaan ${note.deck.slug}.`,
    });
  });

  revalidateCatalog();
  return { ok: true, message: "Note tersimpan." };
}

export async function deleteSystemNoteAction(
  input: DeleteSystemNoteInput,
): Promise<DeckActionResult> {
  const actor = await requireAdmin();

  const validated = DeleteSystemNoteSchema.safeParse(input);
  if (!validated.success) return { ok: false, message: "Data tidak valid." };

  const note = await prisma.flashcardSystemNote.findUnique({
    where: { id: validated.data.id },
    select: { guid: true, deck: { select: { slug: true } } },
  });
  if (!note) notFound();

  await prisma.$transaction(async (tx) => {
    await tx.flashcardSystemNote.delete({ where: { id: validated.data.id } });
    await recordAdminActionTx(tx, {
      actor,
      action: "system-note.delete",
      targetType: "system-note",
      targetId: validated.data.id,
      summary: `Menghapus note ${note.guid} dari deck bawaan ${note.deck.slug}.`,
    });
  });

  revalidateCatalog();
  return { ok: true, message: "Note dihapus." };
}

export type ExportResult =
  | { ok: true; fileName: string; json: string }
  | { ok: false; message: string };

/**
 * Mengembalikan isi deck dalam bentuk file fixture, untuk ditimpakan ke
 * `src/flashcard-deck-data/<slug>.json`.
 *
 * Tanpa langkah ini, seluruh penyuntingan lewat UI akan hilang pada
 * `npm run seed:flashcard-deck` berikutnya: seed memperlakukan file sebagai
 * sumber kebenaran dan menghapus note yang tidak ada di dalamnya.
 */
export async function exportSystemDeckAction(
  input: ExportSystemDeckInput,
): Promise<ExportResult> {
  await requireAdmin();

  const validated = ExportSystemDeckSchema.safeParse(input);
  if (!validated.success) return { ok: false, message: "Data tidak valid." };

  const fixture = await buildDeckFixture(validated.data.id);
  if (!fixture) notFound();

  return { ok: true, fileName: `${fixture.slug}.json`, json: fixture.json };
}
