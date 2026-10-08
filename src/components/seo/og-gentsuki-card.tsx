/* eslint-disable @next/next/no-img-element */
import "server-only";

import { readFile } from "node:fs/promises";
import { join } from "node:path";
import { ImageResponse } from "next/og";
import { OG_SIZE } from "@/lib/seo";

export const GENTSUKI_OG_ALT =
  "Deck Anki SIM Gentsuki Jepang dengan gambar skuter di lintasan latihan";

export async function renderGentsukiOgImage() {
  const [heroImage, notoSansJpBold] = await Promise.all([
    readFile(join(process.cwd(), "public/gentsuki/gentsuki-hero-og.jpg")),
    readFile(join(process.cwd(), "assets/fonts/NotoSansJP-Bold.ttf")),
  ]);
  const heroImageData = `data:image/jpeg;base64,${heroImage.toString("base64")}`;

  return new ImageResponse(
    (
      <div
        style={{
          width: "100%",
          height: "100%",
          display: "flex",
          position: "relative",
          overflow: "hidden",
          backgroundColor: "#facc00",
          color: "#111111",
          fontFamily: "Noto Sans JP",
          padding: "52px",
        }}
      >
        <div
          style={{
            position: "absolute",
            inset: 0,
            display: "flex",
            opacity: 0.13,
            backgroundImage:
              "linear-gradient(#111111 2px, transparent 2px), linear-gradient(90deg, #111111 2px, transparent 2px)",
            backgroundSize: "38px 38px",
          }}
        />

        <div
          style={{
            position: "relative",
            width: "64%",
            display: "flex",
            flexDirection: "column",
            justifyContent: "space-between",
            paddingRight: "42px",
          }}
        >
          <div
            style={{
              display: "flex",
              alignSelf: "flex-start",
              border: "5px solid #111111",
              backgroundColor: "#ffffff",
              padding: "10px 18px",
              boxShadow: "7px 7px 0 #111111",
              fontSize: 21,
              fontWeight: 900,
              letterSpacing: "0.1em",
              textTransform: "uppercase",
            }}
          >
            Deck Anki Gentsuki
          </div>

          <div style={{ display: "flex", flexDirection: "column" }}>
            <div
              style={{
                display: "flex",
                maxWidth: 700,
                fontSize: 70,
                lineHeight: 0.94,
                letterSpacing: "-0.055em",
                fontWeight: 900,
                textTransform: "uppercase",
              }}
            >
              Siap ujian. Pakai Anki.
            </div>
            <div
              style={{
                display: "flex",
                maxWidth: 680,
                marginTop: 24,
                fontSize: 25,
                lineHeight: 1.3,
                fontWeight: 700,
              }}
            >
              Satu file .apkg untuk mendampingi persiapan SIM gentsuki di Jepang.
            </div>
            <div style={{ display: "flex", gap: 12, marginTop: 28 }}>
              {["LANGSUNG UNDUH", "SEKITAR 20 MB"].map((label) => (
                <div
                  key={label}
                  style={{
                    display: "flex",
                    border: "4px solid #111111",
                    backgroundColor: label === "LANGSUNG UNDUH" ? "#5294ff" : "#ffffff",
                    padding: "10px 15px",
                    boxShadow: "5px 5px 0 #111111",
                    fontSize: 18,
                    fontWeight: 900,
                  }}
                >
                  {label}
                </div>
              ))}
            </div>
          </div>
        </div>

        <div
          style={{
            position: "relative",
            width: "36%",
            height: "100%",
            display: "flex",
            flexDirection: "column",
            border: "7px solid #111111",
            backgroundColor: "#ffffff",
            boxShadow: "14px 14px 0 #111111",
            transform: "rotate(2deg)",
            padding: "12px",
          }}
        >
          <img
            src={heroImageData}
            alt=""
            width="390"
            height="430"
            style={{
              width: "100%",
              height: "430px",
              objectFit: "cover",
              objectPosition: "62% center",
              border: "4px solid #111111",
            }}
          />
          <div
            style={{
              display: "flex",
              flex: 1,
              alignItems: "center",
              justifyContent: "space-between",
              padding: "8px 10px 0",
              fontSize: 22,
              fontWeight: 900,
            }}
          >
            <span style={{ display: "flex" }}>NIHONGOFY</span>
            <span style={{ display: "flex", fontSize: 38 }}>原付</span>
          </div>
        </div>
      </div>
    ),
    {
      ...OG_SIZE,
      fonts: [
        {
          name: "Noto Sans JP",
          data: notoSansJpBold,
          style: "normal",
          weight: 700,
        },
      ],
    },
  );
}
