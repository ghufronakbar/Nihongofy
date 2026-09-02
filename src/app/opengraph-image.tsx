import { ImageResponse } from "next/og";

export const size = {
  width: 1200,
  height: 630,
};
export const contentType = "image/png";

export default function OpenGraphImage() {
  return new ImageResponse(
    (
      <div
        style={{
          width: "100%",
          height: "100%",
          display: "flex",
          position: "relative",
          overflow: "hidden",
          backgroundColor: "#eaf2ff",
          color: "#111111",
          fontFamily: "sans-serif",
          padding: "60px",
        }}
      >
        {/* Grid pattern background */}
        <div
          style={{
            position: "absolute",
            inset: 0,
            display: "flex",
            opacity: 0.12,
            backgroundImage:
              "linear-gradient(#111111 2px, transparent 2px), linear-gradient(90deg, #111111 2px, transparent 2px)",
            backgroundSize: "36px 36px",
          }}
        />

        {/* Decorative neo brutalist background shapes */}
        <div
          style={{
            position: "absolute",
            width: 320,
            height: 320,
            right: -60,
            top: -60,
            display: "flex",
            alignItems: "center",
            justifyContent: "center",
            transform: "rotate(12deg)",
            border: "8px solid #111111",
            backgroundColor: "#facc00",
            boxShadow: "16px 16px 0 #111111",
            fontSize: "140px",
            fontWeight: 900,
          }}
        >
          楽
        </div>

        <div
          style={{
            position: "absolute",
            width: 180,
            height: 180,
            right: 180,
            bottom: -50,
            display: "flex",
            transform: "rotate(-8deg)",
            border: "8px solid #111111",
            backgroundColor: "#5294ff",
            boxShadow: "12px 12px 0 #111111",
          }}
        />

        {/* Content */}
        <div
          style={{
            position: "relative",
            width: "75%",
            display: "flex",
            flexDirection: "column",
            justifyContent: "space-between",
          }}
        >
          <div style={{ display: "flex", gap: "12px", alignItems: "center" }}>
            <div
              style={{
                display: "flex",
                alignItems: "center",
                border: "4px solid #111111",
                backgroundColor: "#facc00",
                padding: "8px 18px",
                fontSize: "20px",
                fontWeight: 900,
                boxShadow: "5px 5px 0 #111111",
                textTransform: "uppercase",
                letterSpacing: "0.1em",
              }}
            >
              楽しい日本語
            </div>
            <div
              style={{
                display: "flex",
                alignItems: "center",
                border: "4px solid #111111",
                backgroundColor: "#ffffff",
                padding: "8px 16px",
                fontSize: "18px",
                fontWeight: 800,
                boxShadow: "5px 5px 0 #111111",
              }}
            >
              JLPT N5 — N1
            </div>
          </div>

          <div style={{ display: "flex", flexDirection: "column" }}>
            <div
              style={{
                display: "flex",
                fontSize: "64px",
                lineHeight: 1.05,
                fontWeight: 900,
                letterSpacing: "-0.05em",
                textTransform: "uppercase",
              }}
            >
              Tanoshii Japanese
            </div>
            <div
              style={{
                display: "flex",
                marginTop: "16px",
                fontSize: "26px",
                lineHeight: 1.3,
                fontWeight: 600,
                color: "#334155",
                maxWidth: "760px",
              }}
            >
              Platform belajar bahasa Jepang & persiapan JLPT interaktif. Latihan Kana, kosakata, latihan cepat, dan mock test resmi.
            </div>

            <div
              style={{
                display: "flex",
                marginTop: "32px",
                gap: "14px",
                alignItems: "center",
                borderTop: "4px solid #111111",
                paddingTop: "20px",
                fontSize: "18px",
                fontWeight: 800,
              }}
            >
              <span style={{ color: "#5294ff" }}>● KANA</span>
              <span>·</span>
              <span style={{ color: "#ff5a5f" }}>● VOCABULARY</span>
              <span>·</span>
              <span style={{ color: "#05d878" }}>● MOCK JLPT</span>
              <span>·</span>
              <span style={{ color: "#facc00" }}>● PROGRESS</span>
            </div>
          </div>
        </div>
      </div>
    ),
    {
      ...size,
    }
  );
}
