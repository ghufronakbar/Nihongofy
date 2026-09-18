import {
  ChatProviderError,
  type ChatProvider,
  type ChatReply,
  type ChatRequest,
  type ChatStreamChunk,
  type FeedbackReply,
  type FeedbackRequest,
} from "./types";

// Provider simulasi untuk Tahap B/C. Ini satu-satunya tempat data simulasi
// boleh hidup (§4.4). Ia sengaja dibuat lambat dan dapat digagalkan supaya
// penilaian UX tidak dilakukan pada kondisi yang terlalu mulus (§11.1).

const BASE_DELAY_MS = 900;
const JITTER_MS = 700;
const SLOW_DELAY_MS = 4500;
const TIMEOUT_DELAY_MS = 2500;

type ScriptedReply = {
  contentJa: string;
  contentTranslation: string;
  contentRomaji: string;
};

const SCRIPTS: Record<string, readonly ScriptedReply[]> = {
  "self-introduction": [
    {
      contentJa: "そうですか。お{名前|なまえ}は{何|なん}ですか。",
      contentTranslation: "Begitu, ya. Siapa namamu?",
      contentRomaji: "Sou desu ka. Onamae wa nan desu ka.",
    },
    {
      contentJa: "いいですね。{今|いま}どこに{住|す}んでいますか。",
      contentTranslation: "Bagus. Sekarang tinggal di mana?",
      contentRomaji: "Ii desu ne. Ima doko ni sunde imasu ka.",
    },
    {
      contentJa: "なるほど。{趣味|しゅみ}は{何|なん}ですか。",
      contentTranslation: "Oh begitu. Apa hobimu?",
      contentRomaji: "Naruhodo. Shumi wa nan desu ka.",
    },
  ],
  "daily-life": [
    {
      contentJa: "{毎日|まいにち}{何|なん}{時|じ}に{起|お}きますか。",
      contentTranslation: "Setiap hari bangun jam berapa?",
      contentRomaji: "Mainichi nanji ni okimasu ka.",
    },
    {
      contentJa: "{朝|あさ}ごはんは{食|た}べましたか。",
      contentTranslation: "Sudah sarapan?",
      contentRomaji: "Asagohan wa tabemashita ka.",
    },
    {
      contentJa: "{週末|しゅうまつ}は{何|なに}をしますか。",
      contentTranslation: "Akhir pekan biasanya melakukan apa?",
      contentRomaji: "Shuumatsu wa nani wo shimasu ka.",
    },
  ],
  food: [
    {
      contentJa: "{好|す}きな{食|た}べ{物|もの}は{何|なん}ですか。",
      contentTranslation: "Makanan kesukaanmu apa?",
      contentRomaji: "Sukina tabemono wa nan desu ka.",
    },
    {
      contentJa: "{日本|にほん}の{料理|りょうり}を{食|た}べたことがありますか。",
      contentTranslation: "Pernah makan masakan Jepang?",
      contentRomaji: "Nihon no ryouri wo tabeta koto ga arimasu ka.",
    },
    {
      contentJa: "からいものは{大丈夫|だいじょうぶ}ですか。",
      contentTranslation: "Kamu kuat makanan pedas?",
      contentRomaji: "Karai mono wa daijoubu desu ka.",
    },
  ],
  shopping: [
    {
      contentJa: "この{店|みせ}は{初|はじ}めてですか。",
      contentTranslation: "Baru pertama kali ke toko ini?",
      contentRomaji: "Kono mise wa hajimete desu ka.",
    },
    {
      contentJa: "{何|なに}を{買|か}いたいですか。",
      contentTranslation: "Mau beli apa?",
      contentRomaji: "Nani wo kaitai desu ka.",
    },
    {
      contentJa: "それは{少|すこ}し{高|たか}いですね。",
      contentTranslation: "Itu agak mahal, ya.",
      contentRomaji: "Sore wa sukoshi takai desu ne.",
    },
  ],
  travel: [
    {
      contentJa: "{旅行|りょこう}が{好|す}きですか。",
      contentTranslation: "Kamu suka bepergian?",
      contentRomaji: "Ryokou ga suki desu ka.",
    },
    {
      contentJa: "{電車|でんしゃ}ではなく、バスで{行|い}きますか。",
      contentTranslation: "Pergi naik bus, bukan kereta?",
      contentRomaji: "Densha de wa naku, basu de ikimasu ka.",
    },
    {
      contentJa: "{京都|きょうと}に{行|い}ったことがありますか。",
      contentTranslation: "Pernah pergi ke Kyoto?",
      contentRomaji: "Kyouto ni itta koto ga arimasu ka.",
    },
  ],
  "work-school": [
    {
      contentJa: "{仕事|しごと}は{忙|いそが}しいですか。",
      contentTranslation: "Pekerjaanmu sibuk?",
      contentRomaji: "Shigoto wa isogashii desu ka.",
    },
    {
      contentJa: "{何|なに}を{勉強|べんきょう}していますか。",
      contentTranslation: "Kamu sedang belajar apa?",
      contentRomaji: "Nani wo benkyou shite imasu ka.",
    },
    {
      contentJa: "{日本語|にほんご}はどのくらい{勉強|べんきょう}しましたか。",
      contentTranslation: "Sudah berapa lama belajar bahasa Jepang?",
      contentRomaji: "Nihongo wa dono kurai benkyou shimashita ka.",
    },
  ],
};

const FALLBACK: readonly ScriptedReply[] = [
  {
    contentJa: "いいですね。もう{少|すこ}し{話|はな}してください。",
    contentTranslation: "Bagus. Coba ceritakan sedikit lagi.",
    contentRomaji: "Ii desu ne. Mou sukoshi hanashite kudasai.",
  },
  {
    contentJa: "そうなんですね。それから、どうしましたか。",
    contentTranslation: "Oh begitu. Lalu, apa yang terjadi?",
    contentRomaji: "Sou nan desu ne. Sorekara, dou shimashita ka.",
  },
];

function delay(ms: number) {
  return new Promise((resolve) => setTimeout(resolve, ms));
}

export function createMockChatProvider(): ChatProvider {
  return {
    id: "mock",

    async reply(request: ChatRequest): Promise<ChatReply> {
      const startedAt = Date.now();
      const failure = request.mockFailure ?? "none";

      if (failure === "timeout") {
        await delay(TIMEOUT_DELAY_MS);
        throw new ChatProviderError("timeout", "Provider tidak merespons tepat waktu.");
      }

      if (failure === "provider_error") {
        await delay(BASE_DELAY_MS);
        throw new ChatProviderError("provider_error", "Provider mengembalikan kegagalan.");
      }

      if (failure === "quota_exceeded") {
        await delay(300);
        throw new ChatProviderError("quota_exceeded", "Kuota harian sudah habis.");
      }

      if (failure === "moderation_flagged") {
        await delay(BASE_DELAY_MS);
        throw new ChatProviderError(
          "moderation_blocked",
          "Pesan ini tidak dapat diproses oleh filter keamanan.",
        );
      }

      await delay(
        failure === "slow" ? SLOW_DELAY_MS : BASE_DELAY_MS + Math.random() * JITTER_MS,
      );

      // Berputar mengikuti jumlah giliran supaya jawaban tidak selalu sama,
      // tanpa membuatnya tampak lebih pintar daripada sebenarnya.
      const turnIndex = request.history.filter((turn) => turn.role === "USER").length;
      // Mode suara tidak memakai topik, jadi pakai pool umum.
      const topicKey =
        request.topicKeys.length > 0
          ? (request.topicKeys[turnIndex % request.topicKeys.length] ?? "")
          : "";
      const pool = SCRIPTS[topicKey] ?? FALLBACK;
      const scripted = pool[turnIndex % pool.length] ?? FALLBACK[0];

      return {
        contentJa: scripted.contentJa,
        contentTranslation: scripted.contentTranslation,
        contentRomaji: scripted.contentRomaji,
        model: "mock",
        latencyMs: Date.now() - startedAt,
        inputTokens: null,
        outputTokens: null,
        moderationFlagged: false,
      };
    },

    async *replyStream(request: ChatRequest): AsyncGenerator<ChatStreamChunk> {
      // Mock tetap mengalirkan potongan supaya UI streaming dapat diuji tanpa
      // biaya dan tanpa provider nyata.
      const reply = await this.reply(request);
      const teks = `JA: ${reply.contentJa}\nID: ${reply.contentTranslation}\nRO: ${reply.contentRomaji}`;

      for (let i = 0; i < teks.length; i += 4) {
        const potongan = teks.slice(i, i + 4);
        await delay(40);
        yield { type: "delta", text: potongan };
      }

      yield { type: "final", reply };
    },

    async feedback(request: FeedbackRequest): Promise<FeedbackReply> {
      await delay(BASE_DELAY_MS);

      return {
        corrections: [
          {
            original: request.userMessage,
            corrected: request.userMessage,
            reason: "Contoh koreksi simulasi. Provider nyata akan mengisi bagian ini.",
            severity: "info",
          },
        ],
        summary: "Ini koreksi simulasi, bukan penilaian nyata.",
        model: "mock",
        latencyMs: BASE_DELAY_MS,
        inputTokens: null,
        outputTokens: null,
      };
    },
  };
}
