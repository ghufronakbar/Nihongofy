import type { JlptLevel } from "@prisma/client";
import type { TestPackageMetadata } from "@/features/test-package/queries";

/**
 * Kartu preview share untuk satu paket mock test, dipakai `opengraph-image`
 * milik `/test-package/[id]` maupun `/test-package/[id]/questions`.
 *
 * Gambar per segmen wajib ada di kedua tempat: gambar dari segmen induk tidak
 * ikut terbawa ke halaman anak yang menulis objek `openGraph`-nya sendiri.
 */
export const TEST_PACKAGE_OG_ALT = "Paket mock test JLPT di Nihongofy";

// Warna per level mengikuti badge di halaman detail supaya preview share dan
// halamannya terbaca sebagai satu hal yang sama.
const LEVEL_PALETTES: Record<JlptLevel, { background: string; accent: string }> = {
  N5: { background: "#05d878", accent: "#facc00" },
  N4: { background: "#5294ff", accent: "#facc00" },
  N3: { background: "#facc00", accent: "#5294ff" },
  N2: { background: "#ff5a5f", accent: "#facc00" },
  N1: { background: "#c084fc", accent: "#facc00" },
};

export function TestPackageOgCard({
  testPackage,
}: {
  // Nullable: OG image tidak boleh ikut 404. Crawler yang gagal memuatnya
  // menampilkan kartu tanpa gambar sama sekali, jadi paket yang hilang tetap
  // dapat kartu bermerek yang generik.
  testPackage: TestPackageMetadata | null;
}) {
  const palette = testPackage
    ? LEVEL_PALETTES[testPackage.jlptLevel]
    : { background: "#eaf2ff", accent: "#facc00" };
  const heading = testPackage?.name ?? "Mock Test JLPT";
  const headingSize = heading.length > 42 ? 62 : heading.length > 28 ? 74 : 86;

  const facts = testPackage
    ? [
        `${testPackage.sessionCount} SESI`,
        `${testPackage.totalMinutes} MENIT`,
        `${testPackage.questionCount} SOAL`,
      ]
    : ["N5 — N1", "DURASI RESMI", "ADA PEMBAHASAN"];

  return (
    <div
      style={{
        width: "100%",
        height: "100%",
        display: "flex",
        position: "relative",
        overflow: "hidden",
        backgroundColor: palette.background,
        color: "#111111",
        fontFamily: "sans-serif",
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
          width: 300,
          height: 300,
          right: -55,
          top: -60,
          display: "flex",
          alignItems: "center",
          justifyContent: "center",
          transform: "rotate(12deg)",
          border: "8px solid #111111",
          backgroundColor: palette.accent,
          boxShadow: "18px 18px 0 #111111",
          fontSize: 150,
          fontWeight: 900,
        }}
      >
        試
      </div>

      <div
        style={{
          position: "relative",
          width: "78%",
          display: "flex",
          flexDirection: "column",
          justifyContent: "space-between",
        }}
      >
        <div style={{ display: "flex", gap: 14, alignItems: "center" }}>
          <div
            style={{
              display: "flex",
              border: "5px solid #111111",
              backgroundColor: "#ffffff",
              padding: "12px 20px",
              fontSize: 30,
              fontWeight: 900,
              letterSpacing: "0.02em",
              boxShadow: "8px 8px 0 #111111",
            }}
          >
            JLPT {testPackage?.jlptLevel ?? "N5 — N1"}
          </div>
          <div
            style={{
              display: "flex",
              border: "4px solid #111111",
              backgroundColor: "#111111",
              color: "#ffffff",
              padding: "11px 18px",
              fontSize: 21,
              fontWeight: 800,
              letterSpacing: "0.08em",
            }}
          >
            MOCK TEST
          </div>
        </div>

        <div style={{ display: "flex", flexDirection: "column" }}>
          <div
            style={{
              display: "flex",
              maxWidth: 880,
              fontSize: headingSize,
              lineHeight: 0.98,
              letterSpacing: "-0.055em",
              fontWeight: 900,
              textTransform: "uppercase",
            }}
          >
            {heading}
          </div>

          <div
            style={{
              display: "flex",
              marginTop: 30,
              gap: 12,
              alignItems: "center",
            }}
          >
            {facts.map((fact) => (
              <div
                key={fact}
                style={{
                  display: "flex",
                  border: "4px solid #111111",
                  backgroundColor: "#ffffff",
                  padding: "10px 16px",
                  fontSize: 22,
                  fontWeight: 900,
                  boxShadow: "5px 5px 0 #111111",
                }}
              >
                {fact}
              </div>
            ))}
          </div>

          <div
            style={{
              display: "flex",
              marginTop: 26,
              alignSelf: "flex-start",
              borderTop: "6px solid #111111",
              paddingTop: 15,
              fontSize: 24,
              fontWeight: 800,
              letterSpacing: "0.04em",
            }}
          >
            NIHONGOFY / SIMULASI JLPT
          </div>
        </div>
      </div>
    </div>
  );
}
