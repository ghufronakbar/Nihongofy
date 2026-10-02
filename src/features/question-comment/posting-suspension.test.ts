import { readFileSync } from "node:fs";
import { fileURLToPath } from "node:url";
import { describe, expect, it } from "vitest";

// `actions.ts` adalah modul "use server" yang mengimpor Prisma dan Redis, jadi
// yang diperiksa adalah sumbernya. Penjaga ini memastikan setiap jalur tulis ke
// diskusi publik tetap memeriksa suspend posting (User.postingSuspendedAt),
// dan jalur yang harus selalu bisa (hapus) tidak ikut terhalang.
const source = readFileSync(fileURLToPath(new URL("./actions.ts", import.meta.url)), "utf8");

/** Isi satu `export async function <name>(...)` sampai fungsi berikutnya. */
function bodyOf(name: string) {
  const start = source.indexOf(`export async function ${name}(`);
  expect(start, name).toBeGreaterThanOrEqual(0);
  const next = source.indexOf("export async function ", start + 1);
  return source.slice(start, next < 0 ? undefined : next);
}

describe("suspend posting diskusi", () => {
  it.each([
    "addQuestionCommentAction",
    "updateQuestionCommentAction",
    "setQuestionCommentVisibilityAction",
    "replyToQuestionCommentAction",
  ])("%s memeriksa suspend sebelum menulis", (name) => {
    const body = bodyOf(name);
    const check = body.indexOf("checkPublicPostingAllowed(");
    expect(check, `${name} tidak memanggil checkPublicPostingAllowed`).toBeGreaterThanOrEqual(0);
    // Ditolak sebelum kuota tulis terpakai dan sebelum baris ditulis.
    expect(check).toBeLessThan(body.indexOf("checkWriteLimit("));
    expect(check).toBeLessThan(body.search(/prisma\.questionComment\.(create|update)\(/));
  });

  it("catatan privat dan menarik ke privat tidak ikut dibatasi", () => {
    expect(bodyOf("addQuestionCommentAction")).toMatch(
      /if \(visibility === "PUBLIC"\) \{\s*const suspended = await checkPublicPostingAllowed/,
    );
    expect(bodyOf("setQuestionCommentVisibilityAction")).toMatch(
      /if \(visibility === "PUBLIC"\) \{\s*const suspended = await checkPublicPostingAllowed/,
    );
  });

  it("menghapus catatan sendiri tidak pernah terhalang suspend", () => {
    expect(bodyOf("deleteQuestionCommentAction")).not.toContain("checkPublicPostingAllowed");
  });

  it("penolakan dikembalikan sebagai pesan, bukan dilempar", () => {
    expect(source).toMatch(
      /async function checkPublicPostingAllowed[\s\S]*?return \{\s*ok: false,\s*message:/,
    );
  });
});
