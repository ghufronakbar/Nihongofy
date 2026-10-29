/** Original, project-owned vector artwork. Run: node scripts/generate-onigiri-assets.mjs */
import { mkdir, writeFile } from "node:fs/promises";
import { fileURLToPath } from "node:url";

const directory = fileURLToPath(
  new URL("../public/mini-games/onigiri-kitchen/", import.meta.url),
);
await mkdir(directory, { recursive: true });
const ink = "#72523e";
const p = (x, y, z = 0) => [470 + (x - y) * 48, 180 + (x + y) * 25 - z];
const polygon = (points, fill, stroke = ink, width = 1.8) =>
  `<polygon points="${points.map((point) => point.join(",")).join(" ")}" fill="${fill}" stroke="${stroke}" stroke-width="${width}" stroke-linejoin="round"/>`;
const path = (d, fill = "none", stroke = ink, width = 1.8) =>
  `<path d="${d}" fill="${fill}" stroke="${stroke}" stroke-width="${width}" stroke-linecap="round" stroke-linejoin="round"/>`;
const ellipse = (x, y, rx, ry, fill, stroke = "none", width = 1.6) =>
  `<ellipse cx="${x}" cy="${y}" rx="${rx}" ry="${ry}" fill="${fill}" stroke="${stroke}" stroke-width="${width}"/>`;
const rect = (x, y, w, h, r, fill, stroke = "none", width = 1.8) =>
  `<rect x="${x}" y="${y}" width="${w}" height="${h}" rx="${r}" fill="${fill}" stroke="${stroke}" stroke-width="${width}"/>`;
const text = (x, y, value, size = 14, fill = ink, more = "") =>
  `<text x="${x}" y="${y}" font-family="'Hiragino Maru Gothic ProN','Yu Gothic',sans-serif" font-size="${size}" fill="${fill}" ${more}>${value}</text>`;
const defs = `<defs>
  <linearGradient id="wood" x1="0" y1="0" x2="0.3" y2="1"><stop stop-color="#efc489"/><stop offset="1" stop-color="#cf9962"/></linearGradient>
  <linearGradient id="cream" x2="0.4" y2="1"><stop stop-color="#fff8dc"/><stop offset="1" stop-color="#e7dfbf"/></linearGradient>
  <linearGradient id="leaf" x2="1" y2="1"><stop stop-color="#a3b966"/><stop offset="1" stop-color="#567f4b"/></linearGradient>
  <linearGradient id="rice" x2="0.4" y2="1"><stop stop-color="#fffef4"/><stop offset="0.65" stop-color="#f6edcf"/><stop offset="1" stop-color="#dcd5b7"/></linearGradient>
  <linearGradient id="skin" x2="0.3" y2="1"><stop stop-color="#ffe4be"/><stop offset="1" stop-color="#f0bf99"/></linearGradient>
  <linearGradient id="sky" x2="0" y2="1"><stop stop-color="#a5c8b2"/><stop offset="1" stop-color="#e5e7bd"/></linearGradient>
</defs>`;
const svg = (body, viewBox = "-130 -190 260 230", width = 260, height = 230) =>
  `<svg xmlns="http://www.w3.org/2000/svg" width="${width}" height="${height}" viewBox="${viewBox}" fill="none">${defs}${body}</svg>`;
async function save(name, body, viewBox, width, height) {
  await writeFile(`${directory}${name}.svg`, svg(body, viewBox, width, height));
}
function box(
  x,
  y,
  w,
  d,
  h,
  top = "#e7c392",
  front = "#c99965",
  side = "#b98554",
) {
  return (
    polygon(
      [p(x, y + d), p(x + w, y + d), p(x + w, y + d, h), p(x, y + d, h)],
      front,
    ) +
    polygon(
      [p(x + w, y), p(x + w, y + d), p(x + w, y + d, h), p(x + w, y, h)],
      side,
    ) +
    polygon(
      [p(x, y, h), p(x + w, y, h), p(x + w, y + d, h), p(x, y + d, h)],
      top,
    )
  );
}
function localBox(w, d, h, colors) {
  return `<g transform="translate(-470 -180)">${box(-w / 2, -d / 2, w, d, h, ...colors)}</g>`;
}
function leaf(x, y, rotation, scale = 1) {
  return `<g transform="translate(${x} ${y}) rotate(${rotation}) scale(${scale})">${path("M0 0 C-26 -4 -28 -35 -9 -47 C13 -43 23 -16 0 0Z", "url(#leaf)", "#56794a", 1.5)}${path("M0 0 L-9 -38", "none", "#bfd08a", 1.2)}</g>`;
}
function plant(x = 0, y = 0, scale = 1) {
  return `<g transform="translate(${x} ${y}) scale(${scale})">${ellipse(2, 0, 35, 12, "#665444", "none").replace('fill="#665444"', 'fill="#665444" opacity=".12"')}${path("M-25 -31 L-20 -6 Q0 8 20 -6 L25 -31Z", "#e3c69d")}${ellipse(0, -31, 25, 12, "#f2d7b1", ink)}${ellipse(0, -32, 18, 7, "#9b7d54")}${leaf(-2, -35, -45, 0.9)}${leaf(2, -35, 45, 1)}${leaf(0, -35, 0, 1.08)}${leaf(-1, -34, -82, 0.72)}${leaf(0, -34, 78, 0.7)}${path("M-17 -16 Q0 -6 17 -16", "none", "#c19f78", 1.2)}</g>`;
}
function onigiri(x = 0, y = 0, scale = 1) {
  return `<g transform="translate(${x} ${y}) scale(${scale})">${ellipse(0, 10, 25, 7, "#a99373", "none").replace('fill="#a99373"', 'fill="#a99373" opacity=".15"')}${path("M-26 8 Q-29 1 -22 -10 L-8 -31 Q0 -43 9 -31 L26 -6 Q33 9 20 13 L-18 14 Q-24 14 -26 8Z", "url(#rice)", "#9f9374", 1.5)}${path("M-10 -6 Q0 -8 10 -6 L11 14 Q1 17 -11 14Z", "#3d5544", "#394e3e", 1.3)}${path("M-6 -1 L-7 10 M-1 -1 L0 11 M4 -1 L5 10", "none", "#6e7b52", 0.8)}${path("M-14 -10 l2 -2 M-8 -20 l1 -2 M3 -26 l2 1 M12 -15 l2 2 M18 -5 l1 2 M-18 2 l2 0", "none", "#ded9b9", 1.3)}</g>`;
}
function tamago(x = 0, y = 0, scale = 1) {
  return `<g transform="translate(${x} ${y}) scale(${scale})">${ellipse(0, 8, 26, 9, "#b39563", "none").replace('fill="#b39563"', 'fill="#b39563" opacity=".15"')}${path("M-24 -6 Q0 -16 25 -4 L24 9 Q0 20 -24 8Z", "url(#rice)", "#a69b7a", 1.5)}${path("M-28 -16 L7 -23 Q14 -24 28 -12 L27 0 L-9 9 L-28 -4Z", "#e9af4b", "#b3823f", 1.5)}${path("M-28 -16 L7 -23 L28 -12 L-9 -2Z", "#ffdb75", "#b3823f", 1.4)}${path("M-4 -22 L5 -22 L16 -15 L16 3 L6 6 L6 -10Z", "#435544", "#435544", 1)}${path("M-21 -13 L-11 -8 M-17 -16 L-10 -13", "none", "#f9e29b", 1.5)}</g>`;
}
function ocha(x = 0, y = 0, scale = 1) {
  return `<g transform="translate(${x} ${y}) scale(${scale})">${ellipse(0, 13, 29, 12, "#e7dbbb", "#a59473", 1.4)}${ellipse(0, 12, 21, 7, "#d2c7a7")}${path("M-19 -17 L-16 9 Q0 23 16 9 L19 -17Z", "#a5b57d", "#697d51", 1.6)}${path("M18 -12 C38 -17 34 8 17 5", "none", "#697d51", 5)}${path("M18 -12 C34 -15 31 5 18 2", "none", "#c1cca0", 2)}${ellipse(0, -17, 19, 10, "#e3e3bb", "#697d51", 1.5)}${ellipse(0, -17, 14, 6.5, "#708745")}${path("M-10 -2 Q0 3 11 -2", "none", "#cad3ac", 1.4)}${path("M-7 -34 C-15 -43 0 -45 -5 -55 M5 -30 C-3 -39 13 -44 7 -53", "none", "#fff8e7", 3)}</g>`;
}

// Architecture is a separate layer so every character and piece of furniture can depth-sort.
let room = ellipse(501, 620, 380, 82, "#76806a").replace(
  'fill="#76806a"',
  'fill="#76806a" opacity=".11"',
);
room += polygon([p(0, 9), p(10, 9), p(10, 9, -20), p(0, 9, -20)], "#b48c58");
room += polygon([p(10, 0), p(10, 9), p(10, 9, -20), p(10, 0, -20)], "#9f784e");
const boards = ["#ead2a3", "#e9cfa0", "#e7cb98", "#edd7ad", "#e5c99a"];
for (let y = 0; y < 18; y++) {
  for (let x = 0; x < 5; x++) {
    const start = x * 2;
    const color = boards[(x * 3 + y * 2) % boards.length];
    room += polygon(
      [
        p(start, y / 2),
        p(start + 2, y / 2),
        p(start + 2, (y + 1) / 2),
        p(start, (y + 1) / 2),
      ],
      color,
      "#c7ad80",
      0.7,
    );
    if ((x + y) % 3 === 0) {
      const a = p(start + 0.2, y / 2 + 0.21),
        b = p(start + 1.5, y / 2 + 0.21);
      room += path(
        `M${a} Q${(a[0] + b[0]) / 2} ${(a[1] + b[1]) / 2 + 1.5} ${b}`,
        "none",
        "#f5e1b9",
        1.1,
      );
    }
  }
}
room += polygon(
  [p(0, 0), p(0, 9), p(0, 9, 156), p(0, 0, 156)],
  "#eee6c9",
  "#987c57",
  2.5,
);
room += polygon(
  [p(0, 0), p(10, 0), p(10, 0, 156), p(0, 0, 156)],
  "#f7efd6",
  "#987c57",
  2.5,
);
room += polygon([p(0, 0), p(0, 9), p(0, 9, 35), p(0, 0, 35)], "#d0b280");
room += polygon([p(0, 0), p(10, 0), p(10, 0, 35), p(0, 0, 35)], "#dbbd88");
for (let i = 0; i <= 9; i++)
  room += path(`M${p(0, i, 5)} L${p(0, i, 34)}`, "none", "#b89b6c", 1.5);
for (let i = 0; i <= 10; i++)
  room += path(`M${p(i, 0, 5)} L${p(i, 0, 34)}`, "none", "#bea16f", 1.5);
room += path(
  `M${p(0, 9, 156)} L${p(0, 0, 156)} L${p(10, 0, 156)}`,
  "none",
  "#a7804e",
  11,
);
room += path(
  `M${p(0, 9, 159)} L${p(0, 0, 159)} L${p(10, 0, 159)}`,
  "none",
  "#d8b27a",
  4,
);
room += path(
  `M${p(0, 9, 36)} L${p(0, 0, 36)} L${p(10, 0, 36)}`,
  "none",
  "#aa8857",
  5,
);

// Left-wall shoji window: local coordinates follow the wall's oblique horizontal axis.
const windowOrigin = p(0, 7.4, 57);
room += `<g transform="matrix(.88 -.458 0 1 ${windowOrigin[0]} ${windowOrigin[1]})">`;
room += rect(-4, -102, 222, 111, 3, "#b4976d", "#8d734f", 2);
room += rect(3, -96, 208, 98, 1, "url(#sky)");
room += path(
  "M3 -29 Q49 -65 80 -32 Q125 -74 166 -26 Q195 -39 211 -30 L211 2 L3 2Z",
  "#a7ba8c",
  "none",
);
room += path(
  "M3 -12 Q77 -49 144 -15 Q185 -28 211 -13 L211 2 L3 2Z",
  "#849d78",
  "none",
);
room += path(
  "M32 0 C35 -28 50 -45 69 -77 M45 -28 L22 -58 M53 -45 L101 -71",
  "none",
  "#947755",
  4,
);
for (const [x, y, r] of [
  [22, -61, 18],
  [58, -79, 23],
  [91, -68, 18],
  [40, -61, 21],
  [71, -59, 18],
]) {
  room += ellipse(x, y, r, r * 0.75, "#e8c4b4");
  room += ellipse(x - 5, y - 5, r * 0.6, r * 0.4, "#f2d5c0");
}
for (let i = 1; i < 5; i++) room += rect(i * 42, -97, 4, 101, 0, "#bc9b6c");
room += rect(3, -51, 208, 4, 0, "#bc9b6c");
room += rect(-11, 5, 236, 10, 2, "#dab785", "#98764b", 1.5) + "</g>";

// Woven wall clock and a small illustrated menu.
const clock = p(0, 2.3, 100);
room += `<g transform="translate(${clock[0]} ${clock[1]})">${ellipse(0, 0, 23, 28, "#b38956", ink, 2)}${ellipse(0, -1, 18, 23, "#fff4d7")}${path("M0 -17 L0 -14 M0 13 L0 16 M-13 0 L-11 0 M11 0 L13 0", "none", "#a28a63", 1.4)}${path("M0 -11 L0 0 L9 5", "none", ink, 2)}${ellipse(0, 0, 2, 2, ink)}</g>`;
const banner = p(4.8, 0, 116);
room += `<g transform="matrix(.9 .469 0 1 ${banner[0]} ${banner[1]})">${rect(-95, -34, 190, 46, 6, "#65806a", "#4b6251", 2)}${rect(-89, -28, 178, 34, 3, "none", "#c4cd9c", 1)}${text(0, -5, "こめと、おちゃ。", 19, "#fff6d8", 'text-anchor="middle" font-weight="700"')}${path("M-76 -35 L-76 -43 M76 -35 L76 -43", "none", "#72523e", 2)}</g>`;
const shelf = p(8.2, 0, 97);
room += `<g transform="matrix(.9 .469 0 1 ${shelf[0]} ${shelf[1]})">${rect(-54, 0, 114, 7, 2, "#bb915f", ink, 1.5)}${rect(-37, -26, 16, 25, 3, "#bdc499", ink, 1.3)}${rect(-16, -32, 21, 31, 4, "#d2a67c", ink, 1.3)}${rect(13, -22, 17, 21, 3, "#e5d9b6", ink, 1.3)}${path("M18 -24 Q6 -39 15 -46 M21 -24 Q31 -37 26 -45", "none", "#799061", 3)}</g>`;

// Soft light on the planks, plus an entrance mat and a low step.
room += polygon(
  [p(0, 6.6), p(0, 4.9), p(5.7, 7.4), p(5.7, 9)],
  "#fff4cb",
  "none",
).replace('fill="#fff4cb"', 'fill="#fff4cb" opacity=".18"');
room += polygon(
  [p(8.15, 7.55), p(9.7, 7.55), p(9.7, 8.7), p(8.15, 8.7)],
  "#9ea879",
  "#7c8b62",
  2,
);
room += polygon(
  [p(8.3, 7.68), p(9.55, 7.68), p(9.55, 8.55), p(8.3, 8.55)],
  "none",
  "#ccd0a0",
  1.5,
);
room += box(8.1, 9, 1.9, 0.45, -7, "#d3af79", "#b38c59", "#af8550");
await save("room", room, "0 0 1000 740", 1000, 740);

for (const food of ["onigiri", "tamago", "ocha"]) {
  let station = ellipse(0, 12, 81, 21, "#8c714e").replace(
    'fill="#8c714e"',
    'fill="#8c714e" opacity=".13"',
  );
  station += localBox(2.1, 1.16, 54, ["#efdbb0", "url(#wood)", "#bf925f"]);
  station += localBox(2.22, 1.28, 60, ["#f7e8c7", "#cdae79", "#ba9866"]);
  station += path(
    "M-71 -16 L-71 4 M-22 10 L-22 30 M26 12 L26 32",
    "none",
    "#a17b51",
    1.7,
  );
  station += path(
    "M-59 -11 l12 6 M-10 15 l12 6 M37 14 l12 -6",
    "none",
    "#f8dbab",
    3.5,
  );
  station +=
    ellipse(-25, -31, 3, 2, "#937045") +
    ellipse(23, -6, 3, 2, "#937045") +
    ellipse(55, -20, 3, 2, "#937045");
  if (food === "onigiri") {
    station += rect(-57, -92, 64, 38, 8, "#bca17a", ink, 1.6);
    station += rect(-52, -89, 54, 30, 6, "#fff4d1", "#a58c65", 1);
    station += onigiri(-34, -68, 0.58) + onigiri(-9, -57, 0.58);
    station += path(
      "M27 -91 Q15 -76 24 -60 Q48 -46 65 -66 Q76 -81 60 -94Z",
      "#e7dfc4",
      "#a89b7b",
      1.6,
    );
    station += ellipse(46, -89, 24, 12, "#fff6de", "#a89b7b", 1.6);
    station += ellipse(46, -91, 18, 8, "#f8f1d7");
    station += path("M40 -90 L58 -117", "none", "#b38a56", 4);
    station += ellipse(57, -116, 7, 4, "#d9b780", ink, 1.3);
    station += rect(-65, -56, 22, 7, 3, "#64806a", "#4c6554", 1);
  } else if (food === "tamago") {
    station += polygon(
      [
        [-55, -79],
        [15, -99],
        [66, -73],
        [-6, -51],
      ],
      "#687269",
      "#576256",
      1.6,
    );
    station += ellipse(-12, -77, 24, 12, "#404d46", "#a3a892", 2.6);
    station += ellipse(-12, -77, 15, 7, "#e9b75c");
    station += path("M-28 -75 L-56 -60", "none", "#5b5042", 7);
    station += path("M-28 -75 L-56 -60", "none", "#9e7651", 4);
    station += tamago(36, -62, 0.57);
    station += rect(38, -118, 19, 25, 5, "#d8c39b", ink, 1.3);
    station += path(
      "M44 -117 L38 -139 M51 -116 L58 -139 M47 -117 L47 -145",
      "none",
      "#9a815d",
      2.6,
    );
    station += path(
      "M-13 -104 C-22 -111 -7 -117 -12 -125",
      "none",
      "#fff9e8",
      2.8,
    );
  } else {
    station += path(
      "M-51 -91 L-47 -62 Q-23 -48 -4 -63 L1 -91Z",
      "#91a17d",
      "#647652",
      1.8,
    );
    station += ellipse(-25, -91, 26, 14, "#bdc79e", "#647652", 1.8);
    station += ellipse(-25, -95, 19, 9, "#aab98d", "#647652", 1.3);
    station += ellipse(-25, -105, 4, 4, "#6c8058", ink, 1.2);
    station += path(
      "M-2 -80 L11 -94 L14 -84 L-1 -67",
      "#91a17d",
      "#647652",
      1.8,
    );
    station += path(
      "M-49 -86 C-70 -119 -21 -133 -7 -104",
      "none",
      "#9f8054",
      6,
    );
    station += path(
      "M-49 -86 C-70 -119 -21 -133 -7 -104",
      "none",
      "#c7ae7a",
      3,
    );
    station += ocha(32, -62, 0.57) + ocha(54, -72, 0.48);
    station += path(
      "M-24 -121 C-31 -133 -17 -138 -22 -147",
      "none",
      "#fff9e8",
      3,
    );
  }
  await save(`station-${food}`, station, "-100 -165 200 225", 200, 225);
}

let table = ellipse(0, 16, 70, 23, "#8c714e").replace(
  'fill="#8c714e"',
  'fill="#8c714e" opacity=".14"',
);
function chair(x, y, mirror = 1) {
  return `<g transform="translate(${x} ${y}) scale(${mirror} 1)">${path("M-17 -25 L-18 -3 M16 -27 L18 -3 M-19 -43 L-23 -24 L-1 -10 L23 -22 L19 -44", "none", "#997348", 5)}${path("M-23 -26 L0 -39 L25 -25 L1 -12Z", "#d8bc87", ink, 1.5)}${path("M-22 -57 Q0 -74 23 -60 L21 -38 Q0 -25 -23 -40Z", "#c6ceac", ink, 1.8)}${path("M-17 -55 Q0 -66 18 -56", "none", "#e2e4c8", 2)}</g>`;
}
table += chair(-41, -49) + chair(48, -14, -1);
table += path("M-13 -50 L-15 8 Q0 19 17 7 L13 -50Z", "#b78c55", ink, 1.6);
table += ellipse(0, 8, 32, 11, "#c29b67", ink, 1.5);
table += ellipse(0, -57, 67, 35, "#ba905e", ink, 1.8);
table += ellipse(0, -63, 67, 35, "#e1bd84", ink, 1.8);
table += ellipse(0, -66, 60, 29, "#f3ebce", "#bca67b", 1.5);
table += path("M-47 -68 Q-27 -89 -4 -87", "none", "#fff8e3", 2);
table +=
  ellipse(-33, -64, 13, 6.5, "#e3d9b9", "#b8aa87", 1) +
  ellipse(-33, -65, 9, 4.5, "#f8f0d7");
table +=
  path("M28 -80 L30 -66 Q37 -61 43 -67 L44 -80Z", "#c8d0ad", "#9ba580", 1.2) +
  ellipse(36, -81, 8, 4, "#f2f2d3", "#9ba580", 1);
table += rect(-6, -89, 14, 18, 3, "#d3b898", "#a38a6a", 1.2);
table += path("M0 -88 L-3 -102 M3 -88 L10 -100", "none", "#829362", 1.7);
table +=
  ellipse(-4, -103, 6, 5, "#f2d3ad", "#be9b79", 0.7) +
  ellipse(10, -101, 5, 5, "#ead1ac", "#be9b79", 0.7);
await save("table", table, "-105 -140 210 190", 210, 190);
await save("plant", plant(), "-65 -115 130 145", 130, 145);

let counter = localBox(1.15, 1.15, 58, ["#e9cf9e", "#c59b67", "#b18a58"]);
counter +=
  rect(-26, -99, 38, 27, 3, "#7e8b6b", ink, 1.5) +
  rect(-22, -95, 30, 17, 1, "#c3d3a9");
counter += path(
  "M-5 -75 L-3 -63 L15 -56 L-13 -49 L-28 -57 L-11 -64 L-11 -74",
  "#798266",
  ink,
  1.5,
);
counter +=
  rect(26, -59, 13, 9, 3, "#e9dcbd", ink, 1) +
  ellipse(32, -62, 7, 3, "#bdb18d", ink, 1);
await save("counter", counter, "-90 -135 180 180", 180, 180);

let terrace = polygon(
  [p(10, 9), p(14, 9), p(14, 9, -20), p(10, 9, -20)],
  "#b18e62",
);
terrace += polygon(
  [p(14, 2), p(14, 9), p(14, 9, -20), p(14, 2, -20)],
  "#997b57",
);
for (let y = 4; y < 18; y++) {
  for (let x = 10; x < 14; x++) {
    terrace += polygon(
      [p(x, y / 2), p(x + 1, y / 2), p(x + 1, (y + 1) / 2), p(x, (y + 1) / 2)],
      ["#cdbb91", "#d7c59c", "#d2c099"][(x + y) % 3],
      "#ad9b76",
      0.7,
    );
  }
}
for (let y = 2; y <= 9; y++) {
  terrace += path(`M${p(14, y)} L${p(14, y, 36)}`, "none", "#8f9a70", 5);
}
terrace += path(
  `M${p(14, 2, 36)} L${p(14, 9, 36)} L${p(13.2, 9, 36)}`,
  "none",
  "#9faa7d",
  6,
);
for (const position of [
  [13.65, 2.3],
  [13.65, 8.55],
]) {
  const point = p(...position);
  terrace += plant(point[0], point[1], 0.85);
}
await save("terrace", terrace, "0 0 1260 850", 1260, 850);

let pickup = localBox(1.1, 0.6, 43, ["#e5c899", "#c09b69", "#ae875a"]);
pickup += path("M-36 -40 L2 -60 L37 -42 L-2 -22Z", "#efdfbd", "#a9926e", 1.2);
pickup += ellipse(0, -43, 16, 6, "#f7eed8", "#b6a582", 1.3);
pickup += rect(-13, -17, 26, 12, 2, "#eee3c6", "#ad9875", 1);
pickup += text(
  0,
  -8,
  "PICK UP",
  5,
  "#796849",
  'text-anchor="middle" font-weight="700"',
);
await save("pickup", pickup, "-65 -88 130 115", 130, 115);

let trashBin = ellipse(1, 5, 38, 13, "#665444").replace(
  'fill="#665444"',
  'fill="#665444" opacity=".14"',
);
trashBin += path(
  "M-32 -65 L-27 -1 Q0 18 28 -1 L33 -65Z",
  "#9aa887",
  "#637354",
  2,
);
trashBin += path("M8 -63 L7 7 Q19 6 28 -1 L33 -65Z", "#819374", "none");
trashBin += path(
  "M-22 -53 L-18 -5 M23 -51 L20 -5 M-5 -55 L-4 -2",
  "none",
  "#bac5a4",
  2,
);
trashBin += ellipse(0, -65, 33, 14, "#c0c9aa", "#637354", 2);
trashBin += ellipse(0, -65, 25, 9, "#52634c", "#7e8e6e", 1.5);
trashBin += path(
  "M-33 -79 Q-12 -103 24 -90 L35 -76 Q8 -87 -26 -70Z",
  "#bac5a4",
  "#637354",
  2,
);
trashBin += path("M-6 -92 L-5 -98 L8 -98 L11 -91", "none", "#637354", 3);
trashBin += rect(-16, -48, 32, 27, 5, "#f3ebd2", "#7f8e6b", 1.2);
trashBin += path(
  "M-8 -40 L8 -40 M-3 -43 L3 -43 M-6 -37 L-5 -27 L5 -27 L6 -37 M-2 -35 L-2 -29 M2 -35 L2 -29",
  "none",
  "#7f8e6b",
  1.6,
);
await save("trash-bin", trashBin, "-54 -104 108 130", 108, 130);

function character({
  chef = false,
  waiter = false,
  appearance = 0,
  direction = "front",
  frame = 0,
}) {
  const shirts = ["#a8b8a1", "#dcab86", "#a8b7c1", "#c6abbd"];
  const hairs = ["#66503d", "#b29a77", "#48473d", "#8f7666"];
  const shirt = chef || waiter ? "#f7edcc" : shirts[appearance];
  const hair = chef ? "#75503e" : hairs[appearance];
  const back = direction === "back";
  const side = direction === "side";
  const step = frame === 1 ? -4 : frame === 2 ? 4 : 0;
  let result = ellipse(0, 0, 23, 8, "#6c684b").replace(
    'fill="#6c684b"',
    'fill="#6c684b" opacity=".18"',
  );
  result += path(
    `M-13 -19 L${-14 + step} -3 Q${-10 + step} 2 ${-3 + step} -2 L-2 -20Z`,
    "#5a5846",
    "#544637",
    1.3,
  );
  result += path(
    `M2 -20 L${3 - step} -2 Q${11 - step} 2 ${16 - step} -3 L13 -20Z`,
    "#5a5846",
    "#544637",
    1.3,
  );
  result +=
    ellipse(-8 + step, -2, 9, 4, "#68533f", "#544637", 1.2) +
    ellipse(10 - step, -2, 9, 4, "#68533f", "#544637", 1.2);
  if (chef)
    result += path(
      "M-23 -62 Q-35 -43 -25 -27 L-13 -33 L13 -33 L25 -27 Q37 -49 23 -63Z",
      hair,
      "#624536",
      1.5,
    );
  result += path(
    "M-12 -52 Q-26 -51 -25 -35 L-21 -20 Q0 -10 22 -21 L25 -36 Q25 -53 12 -53Z",
    shirt,
    "#796b50",
    1.5,
  );
  result += path(
    `M-20 -45 Q-31 -43 -28 -29 Q-24 -23 -18 -29 L-15 -40 M20 -45 Q31 -42 28 -29 Q23 -23 17 -29 L15 -40`,
    shirt,
    "#796b50",
    1.4,
  );
  result +=
    ellipse(
      -24,
      -27 + (frame === 1 ? 2 : 0),
      5.5,
      6.5,
      "url(#skin)",
      "#b68c6a",
      1,
    ) +
    ellipse(
      24,
      -27 + (frame === 2 ? 2 : 0),
      5.5,
      6.5,
      "url(#skin)",
      "#b68c6a",
      1,
    );
  if (chef || waiter) {
    result += path(
      "M-14 -49 L-12 -18 Q0 -12 14 -19 L15 -49 L9 -53 L6 -41 L-6 -41 L-9 -53Z",
      waiter ? (appearance === 0 ? "#7895a5" : "#ba8b6c") : "#799476",
      "#546d55",
      1.5,
    );
    result += path(
      "M-8 -29 Q0 -24 8 -29 L8 -21 L-8 -21Z",
      "#a2b394",
      "#667e61",
      1,
    );
    result += path("M-18 -35 L-23 -38 M18 -35 L23 -38", "none", "#61785a", 1.5);
  } else {
    result += path(
      "M-3 -50 L0 -40 L5 -50 M0 -40 L0 -22",
      "none",
      "#82745f",
      1.1,
    );
    result += ellipse(5, -36, 1.2, 1.2, "#82745f");
  }
  result += ellipse(0, -63, 27, 28, hair, "#5f4939", 1.7);
  if (!back) {
    result += ellipse(
      side ? 5 : 0,
      -60,
      side ? 22 : 25,
      23,
      "url(#skin)",
      "#b48664",
      1.3,
    );
    result +=
      ellipse(side ? -16 : -25, -59, 4.5, 6, "url(#skin)", "#b48664", 1.1) +
      (side ? "" : ellipse(25, -59, 4.5, 6, "url(#skin)", "#b48664", 1.1));
    result += path(
      side
        ? "M-20 -61 Q-30 -85 -7 -91 Q21 -96 26 -73 Q8 -75 -2 -80 Q-1 -68 -11 -65Z"
        : "M-25 -60 Q-32 -84 -8 -91 Q16 -98 27 -77 L26 -66 Q14 -69 8 -81 Q5 -69 -6 -67 L-4 -79 Q-10 -68 -25 -60Z",
      hair,
      "#604535",
      1.6,
    );
    if (side) {
      result +=
        ellipse(14, -61, 3, 4.7, "#4d3f32") +
        ellipse(15, -63, 1, 1.4, "#fff9df");
      result += ellipse(17, -51, 5, 2.5, "#e9a68e");
      result += path(
        "M20 -57 L24 -54 L20 -52 M11 -45 Q15 -43 18 -46",
        "none",
        "#a2785b",
        1,
      );
    } else {
      result +=
        ellipse(-10, -61, 3.4, 4.7, "#4d3f32") +
        ellipse(10, -61, 3.4, 4.7, "#4d3f32");
      result +=
        ellipse(-9.2, -62.7, 1.1, 1.4, "#fff9df") +
        ellipse(10.8, -62.7, 1.1, 1.4, "#fff9df");
      result +=
        ellipse(-16, -52, 5.5, 2.7, "#e9a68e") +
        ellipse(16, -52, 5.5, 2.7, "#e9a68e");
      result += path("M-4 -46 Q0 -42 5 -46", "none", "#9e6c52", 1.3);
      result += path(
        "M-14 -70 Q-10 -72 -6 -70 M6 -70 Q10 -72 14 -70",
        "none",
        hair,
        1.5,
      );
    }
  } else {
    result += path(
      "M-17 -73 Q-6 -82 8 -77 M-9 -62 Q1 -69 12 -65",
      "none",
      "#8c6950",
      1.3,
    );
    if (chef)
      result += path(
        "M-14 -39 L14 -39 M-2 -39 Q-16 -47 -14 -37 Q-9 -30 -2 -39 Q14 -46 14 -38 Q10 -30 -2 -39 L-6 -26 M-2 -39 L5 -26",
        "none",
        "#bac6a3",
        2,
      );
  }
  if (chef) {
    result += path(
      "M-28 -82 Q-33 -93 -24 -100 Q-20 -115 -7 -108 Q3 -118 14 -109 Q29 -111 31 -97 Q37 -84 27 -81Z",
      "#faf1d7",
      "#a18b68",
      1.6,
    );
    result += path(
      "M-25 -85 Q0 -92 27 -85 L25 -76 Q1 -82 -24 -76Z",
      "#d9dfc0",
      "#899574",
      1.2,
    );
    result += path(
      "M-15 -101 Q-17 -95 -13 -91 M4 -106 Q0 -100 3 -94 M22 -100 L20 -93",
      "none",
      "#e3dac0",
      1.5,
    );
  } else if (!waiter && appearance === 1) {
    result += path(
      "M-32 -80 Q0 -99 33 -80 Q2 -70 -32 -80Z",
      "#dbb778",
      "#96784f",
      1.4,
    );
    result += path(
      "M-21 -84 L-18 -100 Q0 -110 18 -100 L22 -84 Q0 -77 -21 -84Z",
      "#edd09a",
      "#96784f",
      1.4,
    );
    result += path("M-20 -86 Q0 -80 21 -86", "none", "#8c9270", 4);
  }
  return result;
}
for (const direction of ["front", "back", "side"]) {
  for (let frame = 0; frame < 3; frame++)
    await save(
      `chef-${direction}-${frame}`,
      character({ chef: true, direction, frame }),
      "-45 -120 90 135",
      90,
      135,
    );
}
for (let appearance = 0; appearance < 4; appearance++)
  await save(
    `customer-${appearance}`,
    character({ appearance }),
    "-45 -120 90 135",
    90,
    135,
  );
for (let appearance = 0; appearance < 2; appearance++) {
  for (const direction of ["front", "back", "side"]) {
    for (let frame = 0; frame < 3; frame++) {
      await save(
        `waiter-${appearance}-${direction}-${frame}`,
        character({ waiter: true, appearance, direction, frame }),
        "-45 -120 90 135",
        90,
        135,
      );
    }
  }
}
for (const [name, draw] of [
  ["onigiri", onigiri],
  ["tamago", tamago],
  ["ocha", ocha],
])
  await save(`food-${name}`, draw(0, 8, 1.1), "-40 -62 80 92", 80, 92);
await writeFile(
  `${directory}README.md`,
  "# Onigiri Kitchen artwork\n\nOriginal vector artwork authored for Nihongofy. No reference-game images or third-party art are bundled.\n\nRegenerate all SVG assets with `node scripts/generate-onigiri-assets.mjs`. Architecture, furniture, food, and directional character frames are separate assets for runtime depth sorting. SVG is the source format; these assets are not AI-generated raster images.\n",
);
console.log(`Saved original Onigiri Kitchen SVG assets to ${directory}`);
