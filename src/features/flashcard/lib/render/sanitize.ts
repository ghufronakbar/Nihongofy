/**
 * Sanitasi isi field.
 *
 * Deck Anki sering menyimpan HTML di dalam field (`<b>`, `<br>`, `<ruby>`, dan
 * kadang `<img>` / `[sound:...]`). Karena tata letak kartu milik aplikasi dan
 * bukan template user, satu-satunya HTML yang boleh lolos adalah markup inline
 * yang tidak bisa mengubah layout: tidak ada `style=`, `class=`, atribut `on*`,
 * `<script>`, maupun `<style>`.
 *
 * Implementasinya sengaja allowlist murni dan tidak bergantung DOM, supaya
 * hasilnya identik di server dan client.
 */

const ALLOWED_TAGS = new Set([
  "b",
  "strong",
  "i",
  "em",
  "u",
  "br",
  "ruby",
  "rt",
  "rp",
  "rb",
  "sub",
  "sup",
]);

const VOID_TAGS = new Set(["br"]);

/** `[sound:foo.mp3]` milik Anki; media belum didukung sehingga penandanya dibuang. */
const SOUND_PATTERN = /\[sound:[^\]]*\]/g;

const ENTITY_MAP: Record<string, string> = {
  "&": "&amp;",
  "<": "&lt;",
  ">": "&gt;",
  '"': "&quot;",
};

function escapeText(value: string) {
  return value.replace(/[&<>"]/g, (char) => ENTITY_MAP[char] ?? char);
}

export function sanitizeFieldHtml(input: string): string {
  const withoutSound = input.replace(SOUND_PATTERN, "");
  let result = "";
  let index = 0;

  while (index < withoutSound.length) {
    const open = withoutSound.indexOf("<", index);
    if (open === -1) {
      result += escapeText(withoutSound.slice(index));
      break;
    }

    result += escapeText(withoutSound.slice(index, open));

    const close = withoutSound.indexOf(">", open);
    if (close === -1) {
      // "<" yatim tanpa penutup: perlakukan sebagai teks biasa.
      result += escapeText(withoutSound.slice(open));
      break;
    }

    const raw = withoutSound.slice(open + 1, close).trim();
    const isClosing = raw.startsWith("/");
    const name = (isClosing ? raw.slice(1) : raw).split(/[\s/]/)[0]?.toLowerCase() ?? "";

    if (ALLOWED_TAGS.has(name)) {
      // Atribut selalu dibuang, termasuk pada tag yang diizinkan.
      result += isClosing ? `</${name}>` : VOID_TAGS.has(name) ? `<${name} />` : `<${name}>`;
    }

    index = close + 1;
  }

  return result;
}

/** Versi teks polos, dipakai untuk TTS, pencarian, dan checksum dedup. */
export function fieldToPlainText(input: string): string {
  return input
    .replace(SOUND_PATTERN, "")
    .replace(/<br\s*\/?>/gi, " ")
    .replace(/<[^>]*>/g, "")
    .replace(/&nbsp;/gi, " ")
    .replace(/&amp;/gi, "&")
    .replace(/&lt;/gi, "<")
    .replace(/&gt;/gi, ">")
    .replace(/&quot;/gi, '"')
    .replace(/\s+/g, " ")
    .trim();
}
