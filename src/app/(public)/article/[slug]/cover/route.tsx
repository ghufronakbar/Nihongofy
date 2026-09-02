import { ImageResponse } from "next/og";
import { getArticleCoverData } from "@/features/article/queries";

export const runtime = "nodejs";

const PALETTES = [
  { background: "#5294ff", accent: "#facc00", secondary: "#ff5a5f" },
  { background: "#facc00", accent: "#5294ff", secondary: "#05d878" },
  { background: "#05d878", accent: "#ff5a5f", secondary: "#facc00" },
  { background: "#ff5a5f", accent: "#facc00", secondary: "#5294ff" },
];

function paletteForSlug(slug: string) {
  const hash = Array.from(slug).reduce((total, character) => total + character.charCodeAt(0), 0);
  return PALETTES[hash % PALETTES.length];
}

export async function GET(
  _request: Request,
  { params }: { params: Promise<{ slug: string }> },
) {
  const { slug } = await params;
  const article = await getArticleCoverData(slug);
  if (!article) return new Response("Not found", { status: 404 });

  const palette = paletteForSlug(slug);
  const titleSize = article.title.length > 48 ? 62 : article.title.length > 36 ? 72 : 82;

  return new ImageResponse(
    <div
      style={{
        width: "100%",
        height: "100%",
        display: "flex",
        position: "relative",
        overflow: "hidden",
        backgroundColor: palette.background,
        color: "#111111",
        fontFamily: "Arial, sans-serif",
        padding: "58px",
      }}
    >
      <div
        style={{
          position: "absolute",
          inset: 0,
          display: "flex",
          opacity: 0.16,
          backgroundImage:
            "linear-gradient(#111111 2px, transparent 2px), linear-gradient(90deg, #111111 2px, transparent 2px)",
          backgroundSize: "42px 42px",
        }}
      />
      <div
        style={{
          position: "absolute",
          width: 280,
          height: 280,
          right: -55,
          top: -70,
          display: "flex",
          transform: "rotate(12deg)",
          border: "8px solid #111111",
          backgroundColor: palette.accent,
          boxShadow: "18px 18px 0 #111111",
        }}
      />
      <div
        style={{
          position: "absolute",
          width: 190,
          height: 190,
          right: 120,
          bottom: -72,
          display: "flex",
          transform: "rotate(-9deg)",
          border: "8px solid #111111",
          backgroundColor: palette.secondary,
          boxShadow: "14px 14px 0 #111111",
        }}
      />

      <div
        style={{
          position: "relative",
          width: "82%",
          display: "flex",
          flexDirection: "column",
          justifyContent: "space-between",
        }}
      >
        <div
          style={{
            display: "flex",
            alignSelf: "flex-start",
            border: "5px solid #111111",
            backgroundColor: "#ffffff",
            padding: "12px 18px",
            fontSize: 25,
            fontWeight: 800,
            boxShadow: "8px 8px 0 #111111",
          }}
        >
          {article.category}
        </div>
        <div style={{ display: "flex", flexDirection: "column" }}>
          <div
            style={{
              display: "flex",
              maxWidth: 960,
              fontSize: titleSize,
              lineHeight: 0.98,
              letterSpacing: "-0.055em",
              fontWeight: 900,
            }}
          >
            {article.title}
          </div>
          <div
            style={{
              display: "flex",
              marginTop: 28,
              alignSelf: "flex-start",
              borderTop: "6px solid #111111",
              paddingTop: 15,
              fontSize: 24,
              fontWeight: 800,
            }}
          >
            TANOSHII JAPANESE / ARTIKEL BELAJAR
          </div>
        </div>
      </div>
    </div>,
    {
      width: 1200,
      height: 675,
      headers: {
        "Cache-Control": "public, max-age=3600, s-maxage=86400, stale-while-revalidate=604800",
      },
    },
  );
}
