import { ImageResponse } from "next/og";

/**
 * Ikon PNG untuk `manifest.webmanifest`. Android menolak memasang PWA yang
 * hanya menyediakan ikon SVG, dan butuh varian `maskable` tersendiri karena
 * ikon `any` akan terpotong saat OS menerapkan mask-nya.
 *
 * Dirender lewat `next/og` alih-alih menyimpan PNG di `public/`, mengikuti
 * `icon.tsx` dan `apple-icon.tsx` yang sudah ada — satu sumber bentuk, tanpa
 * binary di repo.
 */
const VARIANTS = {
  "192": { size: 192, maskable: false },
  "512": { size: 512, maskable: false },
  maskable: { size: 512, maskable: true },
} as const;

type Variant = keyof typeof VARIANTS;

function isVariant(value: string): value is Variant {
  return value in VARIANTS;
}

export function generateStaticParams() {
  return Object.keys(VARIANTS).map((variant) => ({ variant }));
}

export async function GET(
  _request: Request,
  { params }: { params: Promise<{ variant: string }> },
) {
  const { variant } = await params;
  if (!isVariant(variant)) return new Response("Not found", { status: 404 });

  const { size, maskable } = VARIANTS[variant];
  // Safe zone maskable: glyph harus berada di dalam 80% bagian tengah kanvas.
  const inset = maskable ? Math.round(size * 0.14) : Math.round(size * 0.045);
  const borderWidth = Math.max(2, Math.round(size * 0.035));

  return new ImageResponse(
    (
      <div
        style={{
          width: "100%",
          height: "100%",
          display: "flex",
          alignItems: "center",
          justifyContent: "center",
          backgroundColor: maskable ? "#facc00" : "transparent",
          padding: inset,
        }}
      >
        <div
          style={{
            width: "100%",
            height: "100%",
            display: "flex",
            alignItems: "center",
            justifyContent: "center",
            backgroundColor: "#facc00",
            border: `${borderWidth}px solid #111111`,
            borderRadius: maskable ? 0 : Math.round(size * 0.16),
            color: "#111111",
            fontSize: Math.round(size * (maskable ? 0.58 : 0.6)),
            fontWeight: 900,
            fontFamily: "sans-serif",
          }}
        >
          語
        </div>
      </div>
    ),
    {
      width: size,
      height: size,
      headers: {
        "Cache-Control": "public, max-age=3600, s-maxage=604800, immutable",
      },
    },
  );
}
