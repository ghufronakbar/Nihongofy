import { ImageResponse } from "next/og";
import { BrandOgCard } from "@/components/seo/og-brand-card";
import { OG_ALT, OG_CONTENT_TYPE, OG_SIZE } from "@/lib/seo";

// Kartu X/Twitter memakai gambar yang sama dengan Open Graph. Tanpa file ini
// root hanya memancarkan `twitter:card` tanpa `twitter:image`, dan kartunya
// bergantung pada fallback ke `og:image` yang tidak dijamin setiap crawler.
export const size = OG_SIZE;
export const contentType = OG_CONTENT_TYPE;
export const alt = OG_ALT;

export default function TwitterImage() {
  return new ImageResponse(<BrandOgCard />, { ...size });
}
