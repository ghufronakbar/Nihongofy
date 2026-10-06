import path from "node:path";
import type { MondaiType } from "@prisma/client";
import {
  Circle,
  Document,
  Font,
  Line,
  Page,
  Polyline,
  Rect,
  StyleSheet,
  Svg,
  Text,
  View,
  renderToBuffer,
} from "@react-pdf/renderer";
import type { Styles } from "@react-pdf/renderer";
import type { ReactNode } from "react";
import { MONDAI_TYPE_LABELS } from "@/constants/jlpt";
import { MONDAI_WEIGHTS, type ScoringSectionKey } from "@/lib/jlpt-score";
import {
  FULL_TEST_MAX_SCORE,
  SECTION_SHORT_LABELS,
  STRONG_ACCURACY,
  WEAK_ACCURACY,
  formatSigned,
  type ProgressReport,
  type ReportAttempt,
  type ReportMondai,
  type ReportSectionSummary,
} from "../lib/report-data";

// Report PDF /progress, dirender di server dengan @react-pdf/renderer.
// Font Noto Sans JP di-embed (otomatis di-subset per glyph oleh react-pdf)
// supaya kanji/kana di nama paket & label mondai tampil — font bawaan PDF
// (Helvetica dkk.) hanya mencakup Latin-1. File font ikut ke bundle function
// lewat `outputFileTracingIncludes` di next.config.ts.

const FONT_FAMILY = "NotoSansJP";
let fontsRegistered = false;

function registerFonts() {
  if (fontsRegistered) return;
  const fontDir = path.join(process.cwd(), "assets", "fonts");
  Font.register({
    family: FONT_FAMILY,
    fonts: [
      { src: path.join(fontDir, "NotoSansJP-Regular.ttf"), fontWeight: 400 },
      { src: path.join(fontDir, "NotoSansJP-Bold.ttf"), fontWeight: 700 },
    ],
  });
  // Tanpa ini react-pdf memenggal kata pakai pola bahasa Inggris
  // ("Pemaha-man"); label di report cukup pendek untuk tidak dipenggal.
  Font.registerHyphenationCallback((word) => [word]);
  fontsRegistered = true;
}

const INK = "#111111";
const PAPER = "#eef5ff";
const YELLOW = "#facc00";
const BLUE = "#5294ff";
const CORAL = "#ff5a5f";
const GREEN = "#05d878";
// Cukup gelap untuk ≥ 4.5:1 di atas putih maupun kuning (kartu prioritas).
const MUTED = "#4b5160";
const FAINT = "#d9dee7";
// Teks status: versi gelap dari hijau/merah supaya tetap terbaca di putih.
const STRONG_TEXT = "#047857";
const BLUE_TEXT = "#2563eb";
const WEAK_TEXT = "#c81e2b";
const PASS_ZONE = "#ffe8e9";

const MONDAI_ORDER = Object.keys(MONDAI_WEIGHTS) as MondaiType[];
const SECTION_KEYS: ScoringSectionKey[] = ["GENGO_CHISHIKI", "DOKKAI", "CHOUKAI"];
const SECTION_COLORS: Record<ScoringSectionKey, string> = {
  GENGO_CHISHIKI: YELLOW,
  DOKKAI: BLUE,
  CHOUKAI: GREEN,
};
const MATRIX_MAX_ATTEMPTS = 10;

const styles = StyleSheet.create({
  page: {
    fontFamily: FONT_FAMILY,
    fontSize: 9,
    color: INK,
    backgroundColor: "#ffffff",
    paddingTop: 32,
    paddingBottom: 48,
    paddingHorizontal: 34,
  },
  footer: {
    position: "absolute",
    left: 34,
    right: 34,
    bottom: 20,
    flexDirection: "row",
    justifyContent: "space-between",
    borderTopWidth: 1.5,
    borderTopColor: INK,
    paddingTop: 6,
    fontSize: 7,
    color: MUTED,
  },
  kicker: {
    alignSelf: "flex-start",
    borderWidth: 1.5,
    borderColor: INK,
    backgroundColor: "#ffffff",
    paddingHorizontal: 6,
    paddingVertical: 2,
    fontSize: 7,
    fontWeight: 700,
    letterSpacing: 1.2,
    textTransform: "uppercase",
  },
  sectionTitle: {
    fontSize: 13,
    fontWeight: 700,
    textTransform: "uppercase",
    letterSpacing: 0.4,
  },
  sectionSubtitle: {
    fontSize: 8,
    color: MUTED,
    marginTop: 2,
  },
  cardTitleRow: {
    flexDirection: "row",
    justifyContent: "space-between",
    alignItems: "flex-end",
    borderBottomWidth: 2,
    borderBottomColor: INK,
    paddingBottom: 6,
    marginBottom: 10,
  },
  muted: { color: MUTED },
  bold: { fontWeight: 700 },
});

function accuracyColor(accuracy: number) {
  if (accuracy < WEAK_ACCURACY) return WEAK_TEXT;
  if (accuracy >= STRONG_ACCURACY) return STRONG_TEXT;
  return INK;
}

function accuracyFill(accuracy: number) {
  if (accuracy < WEAK_ACCURACY) return CORAL;
  if (accuracy >= STRONG_ACCURACY) return GREEN;
  return YELLOW;
}

// Kartu neo-brutalist: border tebal + bayangan keras (kotak tinta di belakang).
// Kartu yang boleh terpotong antarhalaman (`wrap`, mis. tabel panjang) memakai
// border kanan/bawah tebal sebagai bayangan, karena kotak absolut di belakang
// tidak ikut terbelah dengan benar.
function Card({
  children,
  background = "#ffffff",
  padding = 12,
  style,
  wrap = false,
}: {
  children: ReactNode;
  background?: string;
  padding?: number;
  style?: Styles[string];
  wrap?: boolean;
}) {
  if (wrap) {
    return (
      <View
        style={{
          borderWidth: 2,
          borderRightWidth: 5,
          borderBottomWidth: 5,
          borderColor: INK,
          backgroundColor: background,
          padding,
          ...style,
        }}
      >
        {children}
      </View>
    );
  }

  return (
    <View style={{ position: "relative", marginRight: 3, marginBottom: 3, ...style }} wrap={false}>
      <View
        style={{ position: "absolute", top: 3, left: 3, right: -3, bottom: -3, backgroundColor: INK }}
      />
      <View style={{ flexGrow: 1, borderWidth: 2, borderColor: INK, backgroundColor: background, padding }}>
        {children}
      </View>
    </View>
  );
}

function CardTitle({ title, subtitle, right }: { title: string; subtitle?: string; right?: ReactNode }) {
  return (
    <View style={styles.cardTitleRow}>
      <View>
        <Text style={styles.sectionTitle}>{title}</Text>
        {subtitle && <Text style={styles.sectionSubtitle}>{subtitle}</Text>}
      </View>
      {right}
    </View>
  );
}

function Footer({ report, userName }: { report: ProgressReport; userName: string }) {
  return (
    <View style={styles.footer} fixed>
      <Text>
        Nihongofy · Laporan Progres JLPT {report.level} · {userName}
      </Text>
      <Text render={({ pageNumber, totalPages }) => `Halaman ${pageNumber} / ${totalPages}`} />
    </View>
  );
}

function PageHeading({ kicker, title, subtitle }: { kicker: string; title: string; subtitle: string }) {
  return (
    <View style={{ marginBottom: 14 }}>
      <Text style={[styles.kicker, { backgroundColor: YELLOW }]}>{kicker}</Text>
      <Text style={{ fontSize: 18, fontWeight: 700, marginTop: 6, textTransform: "uppercase" }}>
        {title}
      </Text>
      <Text style={styles.sectionSubtitle}>{subtitle}</Text>
    </View>
  );
}

// ---------------------------------------------------------------------------
// Halaman 1 — ringkasan
// ---------------------------------------------------------------------------

function Hero({
  report,
  userName,
  generatedLabel,
}: {
  report: ProgressReport;
  userName: string;
  generatedLabel: string;
}) {
  const meta: [string, string][] = [
    ["Nama", userName],
    ["Periode", report.periodLabel],
    ["Dibuat", generatedLabel],
  ];

  return (
    <View style={{ position: "relative", marginRight: 4, marginBottom: 16 }} wrap={false}>
      <View
        style={{ position: "absolute", top: 5, left: 5, right: -5, bottom: -5, backgroundColor: INK }}
      />
      <View
        style={{
          position: "relative",
          overflow: "hidden",
          borderWidth: 2.5,
          borderColor: INK,
          backgroundColor: YELLOW,
          padding: 14,
        }}
      >
        <View
          style={{
            position: "absolute",
            top: -26,
            right: -18,
            width: 92,
            height: 92,
            backgroundColor: BLUE,
            borderWidth: 2.5,
            borderColor: INK,
            transform: "rotate(14deg)",
          }}
        />
        <View
          style={{
            position: "absolute",
            bottom: -22,
            right: 96,
            width: 52,
            height: 52,
            backgroundColor: CORAL,
            borderWidth: 2.5,
            borderColor: INK,
            transform: "rotate(-12deg)",
          }}
        />

        <View style={{ flexDirection: "row", alignItems: "center" }}>
          <View
            style={{
              width: 26,
              height: 26,
              borderWidth: 2,
              borderColor: INK,
              backgroundColor: "#ffffff",
              alignItems: "center",
              justifyContent: "center",
              marginRight: 7,
            }}
          >
            <Text style={{ fontSize: 13, fontWeight: 700 }}>語</Text>
          </View>
          <View>
            <Text style={{ fontSize: 10, fontWeight: 700, letterSpacing: 1.5 }}>NIHONGOFY</Text>
            <Text style={{ fontSize: 6.5, letterSpacing: 1.2, color: "#3d3d3d" }}>
              JAPANESE LEARNING
            </Text>
          </View>
        </View>

        <Text style={[styles.kicker, { marginTop: 10 }]}>Rapor Progres</Text>
        <Text style={{ fontSize: 26, fontWeight: 700, marginTop: 4, lineHeight: 1.05 }}>
          JLPT {report.level}
        </Text>
        <Text style={{ fontSize: 13, fontWeight: 700, marginTop: 2 }}>
          Laporan Perkembangan Skor Mock Test
        </Text>

        <View style={{ flexDirection: "row", marginTop: 9 }}>
          {meta.map(([label, value]) => (
            <View key={label} style={{ marginRight: 22 }}>
              <Text style={{ fontSize: 6.5, fontWeight: 700, letterSpacing: 1, color: "#3d3d3d" }}>
                {label.toUpperCase()}
              </Text>
              <Text style={{ fontSize: 9, fontWeight: 700, marginTop: 1 }}>{value}</Text>
            </View>
          ))}
        </View>
      </View>
    </View>
  );
}

// Teks selalu tinta: putih di atas biru/koral tidak memenuhi kontras 4.5:1.
function KpiCard({
  label,
  value,
  unit,
  caption,
  background,
  badge,
}: {
  label: string;
  value: string;
  unit?: string;
  caption: string;
  background: string;
  badge?: { text: string; background: string };
}) {
  return (
    <Card background={background} padding={9} style={{ flex: 1 }}>
      <Text style={{ fontSize: 6.5, fontWeight: 700, letterSpacing: 1 }}>{label}</Text>
      <View style={{ flexDirection: "row", alignItems: "flex-end", marginTop: 3 }}>
        <Text style={{ fontSize: 20, fontWeight: 700, lineHeight: 1.1 }}>{value}</Text>
        {unit && (
          <Text style={{ fontSize: 9, fontWeight: 700, marginLeft: 2, marginBottom: 3 }}>{unit}</Text>
        )}
      </View>
      <Text style={{ fontSize: 7, marginTop: 2, maxLines: 1, textOverflow: "ellipsis" }}>{caption}</Text>
      {badge && (
        <Text
          style={{
            alignSelf: "flex-start",
            marginTop: 5,
            borderWidth: 1.2,
            borderColor: INK,
            backgroundColor: badge.background,
            paddingHorizontal: 4,
            paddingVertical: 1,
            fontSize: 6.5,
            fontWeight: 700,
          }}
        >
          {badge.text}
        </Text>
      )}
    </Card>
  );
}

function KpiRow({ report }: { report: ProgressReport }) {
  const { latest, best, deltaFromFirst, passMark } = report;
  const passBadge = (attempt: ReportAttempt) =>
    attempt.totalPlain >= passMark
      ? { text: `DI ATAS BATAS LULUS ${passMark}`, background: GREEN }
      : { text: `DI BAWAH BATAS LULUS ${passMark}`, background: CORAL };

  return (
    <View style={{ flexDirection: "row", gap: 9, marginBottom: 14 }}>
      <KpiCard
        label="ATTEMPT SELESAI"
        value={`${report.attempts.length}`}
        caption={`${report.fullTests.length} mock lengkap · ${report.sectionOnlyCount} per seksi`}
        background="#ffffff"
      />
      <KpiCard
        label="SKOR TERAKHIR"
        value={latest ? `${latest.totalPlain}` : "—"}
        unit={latest ? `/${FULL_TEST_MAX_SCORE}` : undefined}
        caption={latest ? `${latest.packageName} · ${latest.shortDateLabel}` : "Belum ada mock lengkap"}
        background={BLUE}
        badge={latest ? passBadge(latest) : undefined}
      />
      <KpiCard
        label="SKOR TERBAIK"
        value={best ? `${best.totalPlain}` : "—"}
        unit={best ? `/${FULL_TEST_MAX_SCORE}` : undefined}
        caption={best ? `${best.packageName} · ${best.shortDateLabel}` : "Belum ada mock lengkap"}
        background={GREEN}
      />
      <KpiCard
        label="PERUBAHAN"
        value={deltaFromFirst === null ? "—" : formatSigned(deltaFromFirst)}
        unit={deltaFromFirst === null ? undefined : "poin"}
        caption={
          deltaFromFirst === null || !report.fullTests[0] || !latest
            ? "Butuh ≥ 2 mock lengkap"
            : `dari ${report.fullTests[0].totalPlain} ke ${latest.totalPlain}`
        }
        background={YELLOW}
      />
    </View>
  );
}

function Insights({ report }: { report: ProgressReport }) {
  return (
    <Card style={{ marginBottom: 14 }}>
      <CardTitle title="Ringkasan" />
      {report.insights.map((insight) => (
        <View key={insight} style={{ flexDirection: "row", marginBottom: 4 }}>
          <View
            style={{
              width: 6,
              height: 6,
              backgroundColor: YELLOW,
              borderWidth: 1,
              borderColor: INK,
              marginTop: 3.5,
              marginRight: 7,
            }}
          />
          <Text style={{ flex: 1, fontSize: 9, lineHeight: 1.45 }}>{insight}</Text>
        </View>
      ))}
    </Card>
  );
}

const CHART = {
  width: 495,
  height: 176,
  plotLeft: 30,
  plotRight: 8,
  plotTop: 16,
  plotBottom: 30,
  pointPadding: 18,
};

function TrendChart({ report }: { report: ProgressReport }) {
  const points = report.fullTests;
  const plotWidth = CHART.width - CHART.plotLeft - CHART.plotRight;
  const plotHeight = CHART.height - CHART.plotTop - CHART.plotBottom;
  const plotBottomY = CHART.plotTop + plotHeight;
  const plotRightX = CHART.plotLeft + plotWidth;
  const yOf = (value: number) => CHART.plotTop + plotHeight * (1 - value / FULL_TEST_MAX_SCORE);
  const xOf = (index: number) =>
    points.length === 1
      ? CHART.plotLeft + plotWidth / 2
      : CHART.plotLeft +
        CHART.pointPadding +
        (index * (plotWidth - CHART.pointPadding * 2)) / (points.length - 1);
  const yTicks = [0, 45, 90, 135, 180];

  // Label nilai di semua titik selama masih lega; kalau padat cukup titik
  // pertama, terakhir, dan terbaik. Label sumbu X juga dijarangkan.
  const labelAll = points.length <= 10;
  const xLabelStep = Math.ceil(points.length / 12);

  return (
    <Card>
      <CardTitle
        title="Tren Skor Total"
        subtitle={`Skor /${FULL_TEST_MAX_SCORE} tiap mock test lengkap, urut kronologis.`}
        right={
          <View style={{ flexDirection: "row", alignItems: "center" }}>
            <View style={{ width: 14, height: 2.5, backgroundColor: BLUE, marginRight: 4 }} />
            <Text style={{ fontSize: 7, marginRight: 10 }}>Skor total</Text>
            <View
              style={{ width: 14, height: 0, borderTopWidth: 1.5, borderTopColor: CORAL, borderStyle: "dashed", marginRight: 4 }}
            />
            <Text style={{ fontSize: 7 }}>Batas lulus {report.passMark}</Text>
          </View>
        }
      />

      {points.length === 0 ? (
        <View
          style={{
            height: 90,
            borderWidth: 1.5,
            borderColor: FAINT,
            borderStyle: "dashed",
            alignItems: "center",
            justifyContent: "center",
          }}
        >
          <Text style={styles.muted}>Belum ada mock test lengkap untuk digambarkan.</Text>
        </View>
      ) : (
        <View style={{ position: "relative", width: CHART.width, height: CHART.height }}>
          <Svg width={CHART.width} height={CHART.height} style={{ position: "absolute", top: 0, left: 0 }}>
            <Rect
              x={CHART.plotLeft}
              y={yOf(report.passMark)}
              width={plotWidth}
              height={plotBottomY - yOf(report.passMark)}
              fill={PASS_ZONE}
            />
            {yTicks.map((tick) => (
              <Line
                key={tick}
                x1={CHART.plotLeft}
                x2={plotRightX}
                y1={yOf(tick)}
                y2={yOf(tick)}
                stroke={FAINT}
                strokeWidth={0.8}
                strokeDasharray="3 3"
              />
            ))}
            <Line
              x1={CHART.plotLeft}
              x2={plotRightX}
              y1={yOf(report.passMark)}
              y2={yOf(report.passMark)}
              stroke={CORAL}
              strokeWidth={1.5}
              strokeDasharray="5 3"
            />
            <Line x1={CHART.plotLeft} x2={CHART.plotLeft} y1={CHART.plotTop} y2={plotBottomY} stroke={INK} strokeWidth={1.5} />
            <Line x1={CHART.plotLeft} x2={plotRightX} y1={plotBottomY} y2={plotBottomY} stroke={INK} strokeWidth={1.5} />
            {points.length > 1 && (
              <Polyline
                points={points.map((point, index) => `${xOf(index)},${yOf(point.totalPlain)}`).join(" ")}
                fill="none"
                stroke={BLUE}
                strokeWidth={2.5}
              />
            )}
            {points.map((point, index) => (
              <Circle
                key={point.number}
                cx={xOf(index)}
                cy={yOf(point.totalPlain)}
                r={4}
                fill={point === report.best ? GREEN : YELLOW}
                stroke={INK}
                strokeWidth={1.4}
              />
            ))}
          </Svg>

          {yTicks.map((tick) => (
            <Text
              key={tick}
              style={{
                position: "absolute",
                left: 0,
                width: CHART.plotLeft - 5,
                top: yOf(tick) - 5,
                fontSize: 7,
                fontWeight: 700,
                textAlign: "right",
              }}
            >
              {tick}
            </Text>
          ))}
          <Text
            style={{
              position: "absolute",
              right: CHART.plotRight + 2,
              top: yOf(report.passMark) - 11,
              fontSize: 6.5,
              fontWeight: 700,
              color: WEAK_TEXT,
            }}
          >
            Batas lulus {report.passMark}
          </Text>

          {points.map((point, index) => {
            const showValue =
              labelAll || index === 0 || index === points.length - 1 || point === report.best;
            // Label terakhir selalu tampil; label reguler yang terlalu dekat
            // dengannya dilewati supaya tidak berdempetan.
            const lastIndex = points.length - 1;
            const showX =
              index === lastIndex || (index % xLabelStep === 0 && lastIndex - index >= xLabelStep);
            return (
              <View key={point.number}>
                {showValue && (
                  <Text
                    style={{
                      position: "absolute",
                      left: xOf(index) - 16,
                      width: 32,
                      top: yOf(point.totalPlain) - 15,
                      fontSize: 7.5,
                      fontWeight: 700,
                      textAlign: "center",
                    }}
                  >
                    {point.totalPlain}
                  </Text>
                )}
                {showX && (
                  <View
                    style={{
                      position: "absolute",
                      left: xOf(index) - 22,
                      width: 44,
                      top: plotBottomY + 4,
                      alignItems: "center",
                    }}
                  >
                    <Text style={{ fontSize: 7, fontWeight: 700 }}>#{point.number}</Text>
                    <Text style={{ fontSize: 6.5, color: MUTED }}>{point.shortDateLabel}</Text>
                  </View>
                )}
              </View>
            );
          })}
        </View>
      )}

      <Text style={{ fontSize: 7, color: MUTED, marginTop: 8 }}>
        Titik hijau = skor terbaik. Area merah muda = di bawah batas lulus total resmi JLPT{" "}
        {report.level}.
        {report.sectionOnlyCount > 0 &&
          ` ${report.sectionOnlyCount} latihan per seksi tidak masuk grafik ini (skornya bukan /${FULL_TEST_MAX_SCORE}).`}
      </Text>
    </Card>
  );
}

// ---------------------------------------------------------------------------
// Halaman 2 — seksi & mondai
// ---------------------------------------------------------------------------

function SectionCard({ section }: { section: ReportSectionSummary }) {
  const barWidth = 136;
  const xOf = (score: number) => (score / 60) * barWidth;
  const rows: [string, number | null][] = [
    ["Rata-rata", section.average],
    ["Terbaik", section.best],
    ["Terendah", section.worst],
  ];

  return (
    <Card padding={0} style={{ flex: 1 }}>
      <View
        style={{
          flexDirection: "row",
          alignItems: "baseline",
          backgroundColor: SECTION_COLORS[section.key],
          borderBottomWidth: 2,
          borderBottomColor: INK,
          paddingHorizontal: 8,
          paddingVertical: 4,
        }}
      >
        <Text style={{ fontSize: 11, fontWeight: 700, marginRight: 5 }}>{section.label}</Text>
        <Text style={{ fontSize: 7, fontWeight: 700 }}>{section.translation}</Text>
      </View>
      <View style={{ padding: 8 }}>
        {section.latest === null ? (
          <Text style={styles.muted}>Belum ada data.</Text>
        ) : (
          <>
            <View style={{ flexDirection: "row", justifyContent: "space-between" }}>
              <View>
                <Text style={{ fontSize: 6, fontWeight: 700, letterSpacing: 1, color: MUTED }}>TERAKHIR</Text>
                <View style={{ flexDirection: "row", alignItems: "flex-end" }}>
                  <Text style={{ fontSize: 20, fontWeight: 700, lineHeight: 1.1 }}>{section.latest}</Text>
                  <Text style={{ fontSize: 8, fontWeight: 700, marginLeft: 1, marginBottom: 3 }}>/60</Text>
                </View>
              </View>
              <View style={{ width: 70 }}>
                {rows.map(([label, value]) => (
                  <View key={label} style={{ flexDirection: "row", justifyContent: "space-between", marginTop: 1 }}>
                    <Text style={{ fontSize: 7, color: MUTED }}>{label}</Text>
                    <Text style={{ fontSize: 7, fontWeight: 700 }}>{value}</Text>
                  </View>
                ))}
              </View>
            </View>

            {/* Rentang skor terendah–terbaik (biru) + posisi skor terakhir. */}
            <Svg width={barWidth} height={14} style={{ marginTop: 4 }}>
              <Rect x={0} y={4} width={barWidth} height={6} fill={PAPER} stroke={INK} strokeWidth={1} />
              <Rect
                x={xOf(section.worst!)}
                y={4}
                width={Math.max(xOf(section.best!) - xOf(section.worst!), 2)}
                height={6}
                fill={BLUE}
              />
              <Circle
                cx={Math.min(Math.max(xOf(section.latest), 4), barWidth - 4)}
                cy={7}
                r={3.6}
                fill={YELLOW}
                stroke={INK}
                strokeWidth={1.2}
              />
            </Svg>
            <Text style={{ fontSize: 6, color: MUTED, marginTop: 1 }}>
              Biru = terendah–terbaik · {section.attemptCount} attempt
            </Text>
          </>
        )}
      </View>
    </Card>
  );
}

function FocusBox({ report }: { report: ProgressReport }) {
  return (
    <Card background={YELLOW} padding={10} style={{ marginBottom: 14 }}>
      <CardTitle
        title="Prioritas Latihan"
        subtitle={`Mondai dengan akurasi terendah (di bawah ${STRONG_ACCURACY}%) dari seluruh attempt.`}
      />
      {report.focus.length === 0 ? (
        <Text style={{ fontSize: 9, fontWeight: 700 }}>
          Semua mondai sudah di atas {STRONG_ACCURACY}%. Pertahankan dengan paket baru.
        </Text>
      ) : (
        <View style={{ flexDirection: "row", gap: 8 }}>
          {report.focus.map((item, index) => (
            <View
              key={item.mondaiType}
              style={{ flex: 1, borderWidth: 1.5, borderColor: INK, backgroundColor: "#ffffff", padding: 6 }}
            >
              <View style={{ flexDirection: "row", justifyContent: "space-between" }}>
                <View style={{ flex: 1 }}>
                  <View style={{ flexDirection: "row", alignItems: "center", marginBottom: 2 }}>
                    <Text
                      style={{
                        backgroundColor: INK,
                        color: "#ffffff",
                        fontSize: 6.5,
                        fontWeight: 700,
                        paddingHorizontal: 3,
                        marginRight: 4,
                      }}
                    >
                      #{index + 1}
                    </Text>
                    <Text style={{ fontSize: 6.5, fontWeight: 700, color: MUTED }}>
                      {SECTION_SHORT_LABELS[item.section]}
                    </Text>
                  </View>
                  <Text style={{ fontSize: 9.5, fontWeight: 700 }}>{item.label}</Text>
                  <Text style={{ fontSize: 6.5, color: MUTED }}>{item.translation}</Text>
                </View>
                <Text style={{ fontSize: 15, fontWeight: 700, color: accuracyColor(item.accuracy) }}>
                  {item.accuracy}%
                </Text>
              </View>
              <Text style={{ fontSize: 6.5, marginTop: 3 }}>
                {item.correct}/{item.total} benar · {item.attemptCount} attempt
                {item.attemptCount >= 2 &&
                  ` · ${item.firstAccuracy}% → ${item.latestAccuracy}% (${formatSigned(item.latestAccuracy - item.firstAccuracy)})`}
              </Text>
            </View>
          ))}
        </View>
      )}
    </Card>
  );
}

function MondaiBars({ mondai }: { mondai: ReportMondai[] }) {
  const barWidth = 140;
  const columns = { section: 36, count: 34, value: 32, delta: 56 };
  const headText = { fontSize: 6.5, fontWeight: 700, color: MUTED } as const;

  return (
    <Card wrap>
      <CardTitle
        title="Akurasi per Mondai"
        subtitle="Gabungan semua attempt (benar ÷ total soal), diurutkan dari yang terlemah."
        right={
          <View style={{ flexDirection: "row", alignItems: "center" }}>
            {[
              [CORAL, `< ${WEAK_ACCURACY}%`],
              [YELLOW, `${WEAK_ACCURACY}–${STRONG_ACCURACY - 1}%`],
              [GREEN, `≥ ${STRONG_ACCURACY}%`],
            ].map(([color, label]) => (
              <View key={label} style={{ flexDirection: "row", alignItems: "center", marginLeft: 8 }}>
                <View style={{ width: 8, height: 8, backgroundColor: color, borderWidth: 1, borderColor: INK, marginRight: 3 }} />
                <Text style={{ fontSize: 7 }}>{label}</Text>
              </View>
            ))}
          </View>
        }
      />

      <View style={{ flexDirection: "row", paddingBottom: 3, borderBottomWidth: 1, borderBottomColor: FAINT }}>
        <Text style={[headText, { width: columns.section }]}>SEKSI</Text>
        <Text style={[headText, { flex: 1 }]}>MONDAI</Text>
        <Text style={[headText, { width: columns.count, textAlign: "right", paddingRight: 6 }]}>BENAR</Text>
        <Text style={[headText, { width: barWidth }]}>AKURASI</Text>
        <Text style={[headText, { width: columns.value, textAlign: "right" }]}>%</Text>
        <Text style={[headText, { width: columns.delta, textAlign: "right" }]}>AWAL→AKHIR</Text>
      </View>

      {mondai.map((item) => (
        <View
          key={item.mondaiType}
          style={{
            flexDirection: "row",
            alignItems: "center",
            paddingVertical: 2.5,
            borderBottomWidth: 0.6,
            borderBottomColor: FAINT,
          }}
          wrap={false}
        >
          <Text style={{ width: columns.section, fontSize: 7, fontWeight: 700 }}>
            {SECTION_SHORT_LABELS[item.section]}
          </Text>
          <Text style={{ flex: 1, paddingRight: 6, maxLines: 1, textOverflow: "ellipsis" }}>
            <Text style={{ fontSize: 8, fontWeight: 700 }}>{item.label}</Text>
            <Text style={{ fontSize: 6.5, color: MUTED }}>  {item.translation}</Text>
          </Text>
          <Text style={{ width: columns.count, fontSize: 7, color: MUTED, textAlign: "right", paddingRight: 6 }}>
            {item.correct}/{item.total}
          </Text>
          <Svg width={barWidth} height={10}>
            <Rect x={0} y={1} width={barWidth} height={8} fill={PAPER} />
            <Rect
              x={0}
              y={1}
              width={Math.max((item.accuracy / 100) * barWidth, 1)}
              height={8}
              fill={accuracyFill(item.accuracy)}
              stroke={INK}
              strokeWidth={0.8}
            />
            {[WEAK_ACCURACY, STRONG_ACCURACY].map((mark) => (
              <Line
                key={mark}
                x1={(mark / 100) * barWidth}
                x2={(mark / 100) * barWidth}
                y1={0}
                y2={10}
                stroke={INK}
                strokeWidth={0.6}
                strokeDasharray="1.5 1.5"
              />
            ))}
          </Svg>
          <Text
            style={{
              width: columns.value,
              fontSize: 8,
              fontWeight: 700,
              textAlign: "right",
              color: accuracyColor(item.accuracy),
            }}
          >
            {item.accuracy}%
          </Text>
          <Text style={{ width: columns.delta, fontSize: 7.5, fontWeight: 700, textAlign: "right" }}>
            {item.attemptCount >= 2 ? formatSigned(item.latestAccuracy - item.firstAccuracy) : "—"}
          </Text>
        </View>
      ))}
      <Text style={{ fontSize: 7, color: MUTED, marginTop: 6 }}>
        Garis putus-putus di batang = ambang {WEAK_ACCURACY}% dan {STRONG_ACCURACY}%. Kolom Awal→Akhir =
        selisih akurasi attempt pertama dan terakhir yang memuat mondai itu.
      </Text>
    </Card>
  );
}

// ---------------------------------------------------------------------------
// Halaman 3 — detail
// ---------------------------------------------------------------------------

const TABLE_HEAD = {
  fontSize: 6.5,
  fontWeight: 700,
  color: "#ffffff",
} as const;

function AttemptTable({ report }: { report: ProgressReport }) {
  const columns = { no: 20, date: 54, section: 40, total: 50, weighted: 44, accuracy: 38 };

  return (
    <Card padding={0} style={{ marginBottom: 16 }} wrap>
      <View style={{ flexDirection: "row", backgroundColor: INK, paddingVertical: 5, paddingHorizontal: 6 }}>
        <Text style={[TABLE_HEAD, { width: columns.no }]}>#</Text>
        <Text style={[TABLE_HEAD, { width: columns.date }]}>TANGGAL</Text>
        <Text style={[TABLE_HEAD, { flex: 1 }]}>PAKET</Text>
        {SECTION_KEYS.map((key) => (
          <Text key={key} style={[TABLE_HEAD, { width: columns.section, textAlign: "right" }]}>
            {SECTION_SHORT_LABELS[key]}
          </Text>
        ))}
        <Text style={[TABLE_HEAD, { width: columns.total, textAlign: "right" }]}>TOTAL</Text>
        <Text style={[TABLE_HEAD, { width: columns.weighted, textAlign: "right" }]}>BERBOBOT</Text>
        <Text style={[TABLE_HEAD, { width: columns.accuracy, textAlign: "right" }]}>AKURASI</Text>
      </View>
      {report.attempts.map((attempt, index) => {
        const passed = attempt.isFullTest && attempt.totalPlain >= report.passMark;
        return (
          <View
            key={attempt.number}
            style={{
              flexDirection: "row",
              alignItems: "center",
              paddingVertical: 4.5,
              paddingHorizontal: 6,
              backgroundColor: index % 2 === 1 ? "#f7faff" : "#ffffff",
              borderTopWidth: index === 0 ? 0 : 0.6,
              borderTopColor: FAINT,
            }}
            wrap={false}
          >
            <Text style={{ width: columns.no, fontSize: 7.5, fontWeight: 700 }}>{attempt.number}</Text>
            <Text style={{ width: columns.date, fontSize: 7, color: MUTED }}>{attempt.dateLabel}</Text>
            <View style={{ flex: 1, paddingRight: 4 }}>
              <Text style={{ fontSize: 8, fontWeight: 700 }}>{attempt.packageName}</Text>
              {attempt.scopeLabel && (
                <Text style={{ fontSize: 6.5, color: MUTED }}>Latihan seksi: {attempt.scopeLabel}</Text>
              )}
            </View>
            {SECTION_KEYS.map((key) => {
              const section = attempt.sections[key];
              return (
                <Text
                  key={key}
                  style={{
                    width: columns.section,
                    fontSize: 8,
                    fontWeight: 700,
                    textAlign: "right",
                    color: section ? accuracyColor(section.accuracy) : MUTED,
                  }}
                >
                  {section ? section.plainScore : "–"}
                </Text>
              );
            })}
            <Text
              style={{
                width: columns.total,
                fontSize: 8.5,
                fontWeight: 700,
                textAlign: "right",
                color: attempt.isFullTest ? (passed ? STRONG_TEXT : WEAK_TEXT) : INK,
              }}
            >
              {attempt.totalPlain}/{attempt.totalMax}
            </Text>
            <Text style={{ width: columns.weighted, fontSize: 8, fontWeight: 700, textAlign: "right", color: BLUE_TEXT }}>
              {attempt.totalWeighted}/{attempt.totalMax}
            </Text>
            <Text
              style={{
                width: columns.accuracy,
                fontSize: 8,
                fontWeight: 700,
                textAlign: "right",
                color: accuracyColor(attempt.accuracy),
              }}
            >
              {attempt.accuracy}%
            </Text>
          </View>
        );
      })}
    </Card>
  );
}

function MondaiMatrix({ report }: { report: ProgressReport }) {
  const attempts = report.attempts.slice(-MATRIX_MAX_ATTEMPTS);
  const mondaiTypes = MONDAI_ORDER.filter((mondaiType) =>
    report.attempts.some((attempt) => attempt.mondaiAccuracy[mondaiType] !== undefined),
  );
  const cellWidth = 34;

  return (
    <Card padding={0} style={{ marginBottom: 16 }} wrap>
      <View style={{ flexDirection: "row", backgroundColor: INK, paddingVertical: 5, paddingHorizontal: 6 }}>
        <Text style={[TABLE_HEAD, { flex: 1 }]}>MONDAI</Text>
        {attempts.map((attempt) => (
          <View key={attempt.number} style={{ width: cellWidth, alignItems: "flex-end" }}>
            <Text style={TABLE_HEAD}>#{attempt.number}</Text>
            <Text style={{ fontSize: 5.5, color: "#c9ced8" }}>{attempt.shortDateLabel}</Text>
          </View>
        ))}
      </View>
      {mondaiTypes.map((mondaiType, index) => (
        <View
          key={mondaiType}
          style={{
            flexDirection: "row",
            alignItems: "center",
            paddingVertical: 3,
            paddingHorizontal: 6,
            backgroundColor: index % 2 === 1 ? "#f7faff" : "#ffffff",
            borderTopWidth: index === 0 ? 0 : 0.6,
            borderTopColor: FAINT,
          }}
          wrap={false}
        >
          <Text style={{ flex: 1, fontSize: 7.5, fontWeight: 700 }}>{MONDAI_TYPE_LABELS[mondaiType]}</Text>
          {attempts.map((attempt) => {
            const accuracy = attempt.mondaiAccuracy[mondaiType];
            return (
              <Text
                key={attempt.number}
                style={{
                  width: cellWidth,
                  fontSize: 7.5,
                  fontWeight: 700,
                  textAlign: "right",
                  color: accuracy === undefined ? MUTED : accuracyColor(accuracy),
                }}
              >
                {accuracy === undefined ? "–" : `${accuracy}%`}
              </Text>
            );
          })}
        </View>
      ))}
    </Card>
  );
}

function Notes({ report }: { report: ProgressReport }) {
  const notes = [
    `Skor per seksi = benar ÷ total soal × 60, memakai 3 scoring section (言語知識, 読解, 聴解) dengan total ${FULL_TEST_MAX_SCORE}. Ini proyeksi aproksimasi, bukan skor resmi JLPT (algoritma resmi tidak dipublikasikan).`,
    "Skor berbobot memakai bobot kesulitan per mondai (mis. 文の組み立て lebih berat dari 漢字読み), lalu diskalakan ke 60 per seksi.",
    `Batas lulus total resmi JLPT ${report.level} adalah ${report.passMark}/${FULL_TEST_MAX_SCORE}. Batas minimum per seksi tidak dinilai di report ini.`,
    `Warna angka: merah < ${WEAK_ACCURACY}%, hijau ≥ ${STRONG_ACCURACY}%.`,
  ];

  return (
    <View style={{ borderTopWidth: 1.5, borderTopColor: INK, paddingTop: 8 }} wrap={false}>
      <Text style={{ fontSize: 8, fontWeight: 700, marginBottom: 4 }}>CATATAN</Text>
      {notes.map((note) => (
        <Text key={note} style={{ fontSize: 7, color: MUTED, lineHeight: 1.45, marginBottom: 2 }}>
          • {note}
        </Text>
      ))}
    </View>
  );
}

export type ProgressReportInput = {
  report: ProgressReport;
  userName: string;
  generatedLabel: string;
};

function ProgressReportDocument({ report, userName, generatedLabel }: ProgressReportInput) {
  const matrixTrimmed = report.attempts.length > MATRIX_MAX_ATTEMPTS;

  return (
    <Document
      title={`Laporan Progres JLPT ${report.level} — ${userName}`}
      author="Nihongofy"
      subject={`Laporan perkembangan skor mock test JLPT ${report.level}`}
      creator="Nihongofy"
      producer="Nihongofy"
      language="id"
    >
      <Page size="A4" style={styles.page}>
        <Hero report={report} userName={userName} generatedLabel={generatedLabel} />
        <KpiRow report={report} />
        <Insights report={report} />
        <TrendChart report={report} />
        <Footer report={report} userName={userName} />
      </Page>

      <Page size="A4" style={styles.page}>
        <PageHeading
          kicker="Analisis"
          title="Seksi & Mondai"
          subtitle="Di mana skor paling kuat dan bagian mana yang perlu dilatih lebih dulu."
        />
        <View style={{ flexDirection: "row", gap: 9, marginBottom: 14 }}>
          {report.sections.map((section) => (
            <SectionCard key={section.key} section={section} />
          ))}
        </View>
        <FocusBox report={report} />
        {report.mondai.length > 0 && <MondaiBars mondai={report.mondai} />}
        <Footer report={report} userName={userName} />
      </Page>

      <Page size="A4" style={styles.page}>
        <PageHeading
          kicker="Detail"
          title="Rincian per Attempt"
          subtitle="Skor per seksi (/60), total, skor berbobot, dan akurasi tiap attempt."
        />
        <AttemptTable report={report} />
        <View minPresenceAhead={120}>
          <Text style={[styles.sectionTitle, { marginBottom: 2 }]}>Akurasi per Mondai per Attempt</Text>
          <Text style={[styles.sectionSubtitle, { marginBottom: 8 }]}>
            {matrixTrimmed
              ? `Menampilkan ${MATRIX_MAX_ATTEMPTS} attempt terakhir dari ${report.attempts.length}.`
              : "Persentase jawaban benar tiap mondai di setiap attempt."}
          </Text>
        </View>
        <MondaiMatrix report={report} />
        <Notes report={report} />
        <Footer report={report} userName={userName} />
      </Page>
    </Document>
  );
}

export async function renderProgressReport(
  input: ProgressReportInput,
): Promise<Uint8Array<ArrayBuffer>> {
  registerFonts();
  const buffer = await renderToBuffer(<ProgressReportDocument {...input} />);
  return new Uint8Array(buffer);
}
