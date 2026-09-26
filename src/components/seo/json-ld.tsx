import type { JsonLdObject } from "@/lib/json-ld";

/**
 * Menyuntikkan structured data schema.org. `<` di-escape karena string apa pun
 * yang berasal dari database (judul artikel, nama paket) bisa menutup tag
 * `</script>` lebih awal dan berubah menjadi markup yang dieksekusi.
 */
export function JsonLd({ data }: { data: JsonLdObject | JsonLdObject[] }) {
  return (
    <script
      type="application/ld+json"
      dangerouslySetInnerHTML={{
        __html: JSON.stringify(data).replace(/</g, "\\u003c"),
      }}
    />
  );
}
