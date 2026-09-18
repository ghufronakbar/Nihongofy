import Image from "next/image";
import { cn } from "@/lib/utils";
import type { MouthShape } from "../lib/mora-lipsync";
import type { CharacterState, ConversationPersona, PersonaAppearance } from "../types";

// Ilustrasi karakter digambar parametrik sebagai inline SVG: gaya rambut,
// warna, dan aksesori berasal dari fixture persona. Alasannya tiga:
//
// 1. Self-hosted penuh — tidak ada generator avatar pihak ketiga saat runtime (X-5).
// 2. Menambah persona tidak berarti menambah berkas gambar.
// 3. Garis tebal dan warna datar mengikuti bahasa visual neo-brutalist project,
//    jadi karakter terlihat menyatu, bukan tempelan.
//
// Ekspresi berubah menurut `state`, sehingga komponen yang sama dipakai untuk
// pratinjau di setup maupun karakter yang berbicara di runner.

const STROKE = "#111111";

type Crop = "bust" | "head";

const VIEW_BOX: Record<Crop, string> = {
  bust: "0 0 200 210",
  head: "34 24 132 132",
};

// Ekspresi mata yang tersedia sebagai aset. State yang tidak punya layer
// sendiri dipetakan ke yang paling dekat maknanya.
const EYE_LAYER: Record<CharacterState, string> = {
  idle: "neutral",
  talking: "neutral",
  listening: "listening",
  happy: "happy",
  thinking: "thinking",
  tsun: "tsun",
};

export function PersonaCharacter({
  persona,
  state = "idle",
  mouth,
  crop = "bust",
  className,
}: {
  persona: ConversationPersona;
  state?: CharacterState;
  /** Bentuk mulut dari lip-sync. Hanya berlaku pada mode aset berlapis. */
  mouth?: MouthShape;
  crop?: Crop;
  className?: string;
}) {
  if (persona.art) {
    return (
      <PersonaArtwork
        persona={persona}
        state={state}
        mouth={mouth}
        crop={crop}
        className={className}
      />
    );
  }

  return <PersonaVector persona={persona} state={state} crop={crop} className={className} />;
}

// Menumpuk base + seluruh layer ekspresi dan mulut sekaligus. Yang tidak aktif
// dibuat transparan, bukan dilepas dari DOM.
//
// Alasannya penting untuk lip-sync: kalau layer ditukar lewat `src`, setiap
// bentuk mulut yang baru pertama kali muncul harus diunduh dan didekode dulu,
// sehingga pergantian tertinggal dari suaranya. Dengan semua layer sudah
// termuat, pergantian hanya perubahan opacity — tanpa jeda dekode.
const EYE_VARIANTS = ["neutral", "happy", "listening", "thinking", "tsun"] as const;
const MOUTH_VARIANTS = ["closed", "a", "i", "u", "e", "o"] as const;

function PersonaArtwork({
  persona,
  state,
  mouth,
  crop,
  className,
}: {
  persona: ConversationPersona;
  state: CharacterState;
  mouth?: MouthShape;
  crop: Crop;
  className?: string;
}) {
  const art = persona.art;
  if (!art) return null;

  const box = art.crops[crop];

  // Kotak potong dinyatakan dalam piksel sumber, lalu diubah menjadi persen
  // terhadap kontainer. Tidak ada angka transform ajaib: framing mengikuti
  // ukuran yang benar-benar diukur dari asetnya.
  const layerStyle = {
    width: `${(art.width / box.size) * 100}%`,
    left: `${(-box.x / box.size) * 100}%`,
    top: `${(-box.y / box.size) * 100}%`,
  } as const;

  const activeEyes = EYE_LAYER[state];
  const activeMouth = mouth ?? "closed";

  const layerClass = "absolute h-auto max-w-none";

  return (
    <div className={cn("relative h-full w-full overflow-hidden", className)}>
      <Image
        src={`${art.basePath}/base.webp`}
        alt={`Ilustrasi karakter ${persona.name}`}
        width={art.width}
        height={art.height}
        priority
        unoptimized
        style={layerStyle}
        className={layerClass}
      />

      {EYE_VARIANTS.map((variant) => (
        <Image
          key={variant}
          src={`${art.basePath}/eyes-${variant}.webp`}
          alt=""
          aria-hidden
          width={art.width}
          height={art.height}
          loading="eager"
          unoptimized
          style={layerStyle}
          className={cn(layerClass, variant === activeEyes ? "opacity-100" : "opacity-0")}
        />
      ))}

      {MOUTH_VARIANTS.map((variant) => (
        <Image
          key={variant}
          src={`${art.basePath}/mouth-${variant}.webp`}
          alt=""
          aria-hidden
          width={art.width}
          height={art.height}
          loading="eager"
          unoptimized
          style={layerStyle}
          className={cn(layerClass, variant === activeMouth ? "opacity-100" : "opacity-0")}
        />
      ))}
    </div>
  );
}

function PersonaVector({
  persona,
  state,
  crop,
  className,
}: {
  persona: ConversationPersona;
  state: CharacterState;
  crop: Crop;
  className?: string;
}) {
  const look = persona.appearance;

  return (
    <svg
      viewBox={VIEW_BOX[crop]}
      role="img"
      aria-label={`Ilustrasi karakter ${persona.name}`}
      className={cn("h-full w-full", className)}
    >
      <BackHair look={look} />
      <Body look={look} />

      {/* Kepala */}
      <ellipse cx="100" cy="86" rx="46" ry="50" fill={look.skinColor} stroke={STROKE} strokeWidth="4" />
      <Ears look={look} />

      <Eyes look={look} state={state} />
      <Brows state={state} />
      <Mouth state={state} />
      {(state === "happy" || state === "talking" || state === "tsun") && <Blush />}

      <FrontHair look={look} />
      <Accessory look={look} />
    </svg>
  );
}

function Body({ look }: { look: PersonaAppearance }) {
  return (
    <g>
      <path
        d="M60 210 Q62 160 100 150 Q138 160 140 210 Z"
        fill={look.outfitColor}
        stroke={STROKE}
        strokeWidth="4"
        strokeLinejoin="round"
      />
      <path d="M92 150 L100 168 L108 150" fill={look.skinColor} stroke={STROKE} strokeWidth="4" strokeLinejoin="round" />
    </g>
  );
}

function Ears({ look }: { look: PersonaAppearance }) {
  return (
    <g fill={look.skinColor} stroke={STROKE} strokeWidth="4">
      <ellipse cx="54" cy="90" rx="7" ry="11" />
      <ellipse cx="146" cy="90" rx="7" ry="11" />
    </g>
  );
}

function BackHair({ look }: { look: PersonaAppearance }) {
  switch (look.hair) {
    case "long":
      return (
        <path
          d="M46 92 Q40 180 62 196 L138 196 Q160 180 154 92 Q150 40 100 38 Q50 40 46 92 Z"
          fill={look.hairShadeColor}
          stroke={STROKE}
          strokeWidth="4"
          strokeLinejoin="round"
        />
      );
    case "straight":
      return (
        <path
          d="M48 92 Q46 178 54 196 L146 196 Q154 178 152 92 Q148 40 100 38 Q52 40 48 92 Z"
          fill={look.hairShadeColor}
          stroke={STROKE}
          strokeWidth="4"
          strokeLinejoin="round"
        />
      );
    case "twintail":
      return (
        <g fill={look.hairShadeColor} stroke={STROKE} strokeWidth="4" strokeLinejoin="round">
          <path d="M48 90 Q44 60 100 40 Q156 60 152 90 Q150 120 140 128 L60 128 Q50 120 48 90 Z" />
          <path d="M40 86 Q20 120 30 170 Q46 176 54 150 Q52 116 58 96 Z" />
          <path d="M160 86 Q180 120 170 170 Q154 176 146 150 Q148 116 142 96 Z" />
        </g>
      );
    case "bob":
      return (
        <path
          d="M48 92 Q46 130 58 146 L142 146 Q154 130 152 92 Q148 40 100 38 Q52 40 48 92 Z"
          fill={look.hairShadeColor}
          stroke={STROKE}
          strokeWidth="4"
          strokeLinejoin="round"
        />
      );
    default:
      return (
        <path
          d="M50 92 Q48 122 58 136 L142 136 Q152 122 150 92 Q146 42 100 40 Q54 42 50 92 Z"
          fill={look.hairShadeColor}
          stroke={STROKE}
          strokeWidth="4"
          strokeLinejoin="round"
        />
      );
  }
}

function FrontHair({ look }: { look: PersonaAppearance }) {
  const common = { fill: look.hairColor, stroke: STROKE, strokeWidth: 4, strokeLinejoin: "round" as const };

  if (look.hair === "spiky") {
    return (
      <path
        d="M54 66 L64 38 L76 58 L86 32 L100 56 L114 32 L124 58 L136 38 L146 66 Q140 46 100 42 Q60 46 54 66 Z"
        {...common}
      />
    );
  }

  if (look.hair === "messy") {
    return (
      <path
        d="M54 70 Q58 40 100 38 Q142 40 146 70 Q136 54 122 62 Q110 46 96 60 Q80 48 68 62 Q60 58 54 70 Z"
        {...common}
      />
    );
  }

  return (
    <path
      d="M54 72 Q56 38 100 36 Q144 38 146 72 Q134 52 110 58 Q98 44 84 58 Q66 56 54 72 Z"
      {...common}
    />
  );
}

function Eyes({ look, state }: { look: PersonaAppearance; state: CharacterState }) {
  // Mata tertutup melengkung untuk "happy", membesar untuk "listening".
  if (state === "happy") {
    return (
      <g fill="none" stroke={STROKE} strokeWidth="5" strokeLinecap="round">
        <path d="M72 88 Q82 78 92 88" />
        <path d="M108 88 Q118 78 128 88" />
      </g>
    );
  }

  const radiusY = state === "listening" ? 13 : state === "tsun" ? 7 : 11;
  const pupilOffset = state === "thinking" ? -4 : state === "tsun" ? 5 : 0;

  return (
    <g>
      <ellipse cx="82" cy="88" rx="9" ry={radiusY} fill="#FFFFFF" stroke={STROKE} strokeWidth="4" />
      <ellipse cx="118" cy="88" rx="9" ry={radiusY} fill="#FFFFFF" stroke={STROKE} strokeWidth="4" />
      <circle cx={82 + pupilOffset} cy={state === "thinking" ? 85 : 89} r="5" fill={look.eyeColor} />
      <circle cx={118 + pupilOffset} cy={state === "thinking" ? 85 : 89} r="5" fill={look.eyeColor} />
      <circle cx={84 + pupilOffset} cy={state === "thinking" ? 82 : 86} r="2" fill="#FFFFFF" />
      <circle cx={120 + pupilOffset} cy={state === "thinking" ? 82 : 86} r="2" fill="#FFFFFF" />
    </g>
  );
}

function Brows({ state }: { state: CharacterState }) {
  const offset = state === "listening" ? -4 : state === "tsun" ? 3 : 0;

  return (
    <g fill="none" stroke={STROKE} strokeWidth="4" strokeLinecap="round">
      <path d={`M72 ${70 + offset} Q82 ${65 + offset} 92 ${69 + offset}`} />
      <path d={`M108 ${69 + offset} Q118 ${65 + offset} 128 ${70 + offset}`} />
    </g>
  );
}

function Mouth({ state }: { state: CharacterState }) {
  if (state === "talking") {
    // Mulut bicara dianimasikan lewat keyframes di globals.css supaya gerakannya
    // ikut dimatikan oleh prefers-reduced-motion bersama animasi lain.
    return (
      <ellipse
        cx="100"
        cy="114"
        rx="9"
        ry="8"
        fill="#8C3B4A"
        stroke={STROKE}
        strokeWidth="4"
        className="origin-center motion-safe:animate-[persona-mouth_0.42s_ease-in-out_infinite]"
        style={{ transformBox: "fill-box" }}
      />
    );
  }

  if (state === "happy") {
    return <path d="M90 110 Q100 122 110 110" fill="none" stroke={STROKE} strokeWidth="5" strokeLinecap="round" />;
  }

  if (state === "listening") {
    return <circle cx="100" cy="113" r="5" fill="none" stroke={STROKE} strokeWidth="4" />;
  }

  return <path d="M93 113 Q100 118 107 113" fill="none" stroke={STROKE} strokeWidth="4" strokeLinecap="round" />;
}

function Blush() {
  return (
    <g fill="#F58BA0" opacity="0.75">
      <ellipse cx="66" cy="102" rx="9" ry="5" />
      <ellipse cx="134" cy="102" rx="9" ry="5" />
    </g>
  );
}

function Accessory({ look }: { look: PersonaAppearance }) {
  switch (look.accessory) {
    case "ribbon":
      return (
        <g fill="#FF5A5F" stroke={STROKE} strokeWidth="4" strokeLinejoin="round">
          <path d="M128 44 L146 34 L146 56 Z" />
          <path d="M150 44 L168 34 L168 56 Z" />
          <circle cx="148" cy="45" r="5" fill="#FFD1D4" />
        </g>
      );
    case "glasses":
      return (
        <g fill="none" stroke={STROKE} strokeWidth="4">
          <rect x="68" y="76" width="30" height="24" rx="6" />
          <rect x="102" y="76" width="30" height="24" rx="6" />
          <path d="M98 88 L102 88" />
        </g>
      );
    case "headphones":
      return (
        <g fill="#2C2C2C" stroke={STROKE} strokeWidth="4" strokeLinejoin="round">
          <path d="M52 88 Q52 34 100 34 Q148 34 148 88" fill="none" />
          <rect x="42" y="80" width="20" height="30" rx="8" />
          <rect x="138" y="80" width="20" height="30" rx="8" />
        </g>
      );
    default:
      return null;
  }
}
