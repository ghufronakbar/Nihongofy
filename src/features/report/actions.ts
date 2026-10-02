"use server";

import { headers } from "next/headers";
import { notFound } from "next/navigation";
import { Prisma } from "@prisma/client";
import { env, FEATURES } from "@/constants";
import { mondaiTypeFullLabel } from "@/constants/jlpt";
import { getSession } from "@/lib/auth";
import { prisma } from "@/lib/prisma";
import { reportServerError } from "@/lib/server-logger";
import { TURNSTILE_ACTIONS } from "@/features/auth/lib/turnstile-config";
import { verifyTurnstileToken } from "@/features/auth/lib/turnstile";
import {
  consumeAuthRateLimits,
  getRequestIpAddress,
  type AuthRateLimitBucket,
} from "@/features/auth/lib/rate-limit";
import {
  REPORT_TARGET_LABEL_MAX_LENGTH,
  REPORT_USER_AGENT_MAX_LENGTH,
} from "./constants";
import { flashcardReportLabel } from "./lib/flashcard-target";
import {
  SubmitReportSchema,
  type ReportSubmitResult,
  type SubmitReportInput,
  type SubmitReportValues,
} from "./schemas";

// Turnstile, rate limit, dan mailer memang diimpor dari `features/auth`. Itu
// infrastruktur bersama, bukan logika auth — `features/admin/user/actions.ts`
// dan `features/profile/privacy-actions.ts` sudah memakai rate limit dari sana
// dengan cara yang sama. Memindahkan file-nya hanya mengubah alamat impor, bukan
// grafik dependensinya.

const SUCCESS_MESSAGE =
  "Laporan terkirim. Terima kasih — kami membacanya, walau tidak selalu membalas.";
const GENERIC_FAILURE_MESSAGE = "Laporan gagal dikirim. Coba lagi beberapa saat.";
const TURNSTILE_FAILED_MESSAGE =
  "Verifikasi keamanan gagal. Coba ulangi verifikasinya, lalu kirim lagi.";
const DUPLICATE_MESSAGE =
  "Anda sudah mengirim laporan untuk hal yang sama dan masih kami tinjau.";
const VOCAB_NOT_FOUND_MESSAGE = "Kartu yang dilaporkan tidak ditemukan.";

/**
 * Konteks form yang hanya diketahui server: apakah pengirimnya perlu melewati
 * Turnstile, dan apakah ada email akun yang dapat dipakai untuk balasan.
 *
 * Dibaca lewat action, bukan props, supaya tombol "Laporkan" dapat dipasang di
 * komponen client mana pun tanpa merantai sitekey melewati setiap induknya.
 * Sitekey Turnstile memang nilai publik — yang rahasia adalah secret key-nya.
 */
export async function getReportFormContextAction() {
  if (!FEATURES.report) notFound();

  const session = await getSession();
  if (!session) {
    return { requiresCaptcha: true, siteKey: env.CLOUDFLARE_TURNSTILE_SITEKEY, canBeContacted: false };
  }

  const user = await prisma.user.findUnique({
    where: { id: session.userId },
    select: { email: true },
  });

  return {
    requiresCaptcha: false,
    siteKey: null,
    // Akun legacy tanpa email tidak dapat dibalas, jadi checkbox-nya tidak perlu
    // ditawarkan.
    canBeContacted: Boolean(user?.email),
  };
}

export type ReportFormContext = Awaited<ReturnType<typeof getReportFormContextAction>>;

function createReportRateLimitBuckets(
  userId: number | null,
  ipAddress: string | null,
): AuthRateLimitBucket[] {
  const buckets: AuthRateLimitBucket[] = [];

  if (userId) {
    buckets.push({
      scope: "report:user",
      subject: String(userId),
      maxAttempts: 10,
      windowSeconds: 60 * 60,
      blockSeconds: 30 * 60,
    });
  }

  if (ipAddress) {
    // Guest hanya punya IP sebagai subject. Batasnya lebih ketat daripada user
    // login karena tidak ada apa pun yang menahannya selain ini.
    buckets.push({
      scope: userId ? "report:ip" : "report:guest-ip",
      subject: ipAddress,
      maxAttempts: userId ? 30 : 5,
      windowSeconds: 60 * 60,
      blockSeconds: 60 * 60,
    });
  }

  return buckets;
}

/** Hanya kolom FK target; sisa baris disusun oleh `submitReportAction`. */
type TargetColumns = Pick<
  Prisma.ReportUncheckedCreateInput,
  "questionId" | "articleId" | "commentId" | "vocabId"
>;

type ResolvedTarget =
  | { ok: true; targetLabel: string | null; data: TargetColumns }
  | { ok: false; message: string };

function truncate(value: string, max: number) {
  return value.length <= max ? value : `${value.slice(0, max - 1)}…`;
}

/**
 * Memastikan target laporan benar-benar ada, lalu menyusun snapshot labelnya.
 *
 * Label SELALU dibangun di sini dari baris database. Label kiriman client dapat
 * dipalsukan dan akan menyuntikkan teks pilihan pelapor ke layar admin.
 */
async function resolveTarget(
  values: SubmitReportValues,
  viewerId: number | null,
): Promise<ResolvedTarget> {
  if (values.targetType === "GENERAL") {
    return { ok: true, targetLabel: null, data: {} };
  }

  if (values.targetType === "ARTICLE") {
    const article = await prisma.article.findUnique({
      where: { id: values.articleId },
      select: { id: true, title: true },
    });
    if (!article) return { ok: false, message: "Artikel yang dilaporkan tidak ditemukan." };

    return {
      ok: true,
      targetLabel: truncate(`Artikel: ${article.title}`, REPORT_TARGET_LABEL_MAX_LENGTH),
      data: { articleId: article.id },
    };
  }

  if (values.targetType === "COMMENT") {
    const comment = await prisma.questionComment.findUnique({
      where: { id: values.commentId },
      select: {
        id: true,
        userId: true,
        deletedAt: true,
        sharedAt: true,
        visibility: true,
        user: { select: { username: true } },
        question: {
          select: {
            order: true,
            testPackageItem: {
              select: {
                mondaiType: true,
                testPackage: { select: { name: true, jlptLevel: true } },
              },
            },
          },
        },
        vocab: { select: { level: true, wordPlain: true } },
      },
    });

    // Catatan privat hanya terlihat pemiliknya, jadi tidak ada yang dapat
    // melaporkannya; entri yang sudah hilang dari diskusi juga tidak perlu.
    if (!comment || comment.deletedAt || !comment.sharedAt || comment.visibility !== "PUBLIC") {
      return { ok: false, message: "Entri diskusi yang dilaporkan sudah tidak tampil." };
    }
    if (viewerId !== null && comment.userId === viewerId) {
      return {
        ok: false,
        message: "Ini catatan Anda sendiri. Pakai tombol hapus atau jadikan privat.",
      };
    }

    // Tepat satu target terisi (CHECK di database): soal atau kata flashcard.
    const where = comment.question
      ? `${comment.question.testPackageItem.testPackage.jlptLevel} ${comment.question.testPackageItem.testPackage.name} · soal ${comment.question.order}`
      : comment.vocab
        ? `kata ${comment.vocab.level} ${comment.vocab.wordPlain}`
        : "target tidak dikenal";
    return {
      ok: true,
      targetLabel: truncate(
        `Diskusi · ${where} · @${comment.user.username}`,
        REPORT_TARGET_LABEL_MAX_LENGTH,
      ),
      data: { commentId: comment.id },
    };
  }

  if (values.targetType === "FLASHCARD_VOCAB") {
    const vocab = await prisma.flashcardVocab.findUnique({
      where: { id: values.vocabId },
      select: { id: true, key: true, level: true, retiredAt: true },
    });
    if (!vocab) return { ok: false, message: VOCAB_NOT_FOUND_MESSAGE };
    // Kata yang dipensiunkan sudah keluar dari semua deck. Laporannya hanya
    // mungkin datang dari tab lama, dan tidak ada lagi yang perlu diperbaiki.
    if (vocab.retiredAt) {
      return { ok: false, message: "Kartu ini sudah tidak dipakai lagi, jadi tidak perlu dilaporkan." };
    }

    return {
      ok: true,
      targetLabel: truncate(flashcardReportLabel(vocab), REPORT_TARGET_LABEL_MAX_LENGTH),
      data: { vocabId: vocab.id },
    };
  }

  const question = await prisma.question.findUnique({
    where: { id: values.questionId },
    select: {
      id: true,
      order: true,
      explanation: { select: { id: true } },
      testPackageItem: {
        select: {
          mondaiType: true,
          testPackage: { select: { name: true, jlptLevel: true } },
        },
      },
    },
  });
  if (!question) return { ok: false, message: "Soal yang dilaporkan tidak ditemukan." };

  if (values.targetType === "QUESTION_EXPLANATION" && !question.explanation) {
    return { ok: false, message: "Soal ini belum punya pembahasan untuk dilaporkan." };
  }

  const { testPackageItem } = question;
  const base = `${testPackageItem.testPackage.jlptLevel} · ${testPackageItem.testPackage.name} · ${mondaiTypeFullLabel(testPackageItem.mondaiType)} · soal ${question.order}`;

  return {
    ok: true,
    targetLabel: truncate(
      values.targetType === "QUESTION_EXPLANATION" ? `Pembahasan · ${base}` : base,
      REPORT_TARGET_LABEL_MAX_LENGTH,
    ),
    data: { questionId: question.id },
  };
}

export async function submitReportAction(
  input: SubmitReportInput,
): Promise<ReportSubmitResult> {
  if (!FEATURES.report) notFound();

  const validated = SubmitReportSchema.safeParse(input);
  if (!validated.success) {
    return {
      ok: false,
      message: validated.error.issues[0]?.message ?? "Data laporan tidak valid.",
    };
  }

  const values = validated.data;

  // Tombol "Laporkan kartu" hanya ada di bawah /flashcard, yang 404 saat modulnya
  // mati. Action ini dipanggil di luar segmen itu, jadi flag-nya dicek sendiri:
  // tab lama yang masih terbuka tidak boleh tetap dapat mengirim. Dicek sebelum
  // Turnstile dan rate limit supaya penolakan ini tidak memakan jatah pelapor.
  if (values.targetType === "FLASHCARD_VOCAB" && !FEATURES.flashcard) {
    return { ok: false, message: VOCAB_NOT_FOUND_MESSAGE };
  }

  const session = await getSession();
  const ipAddress = await getRequestIpAddress();

  // Guest wajib melewati Turnstile; user login sudah punya akun terverifikasi
  // sebagai penahannya. Yang memutuskan adalah ada-tidaknya session di server,
  // bukan flag dari client.
  if (!session) {
    if (!values.turnstileToken) {
      return { ok: false, message: TURNSTILE_FAILED_MESSAGE };
    }
    const turnstileValid = await verifyTurnstileToken({
      token: values.turnstileToken,
      expectedAction: TURNSTILE_ACTIONS.report,
      remoteIp: ipAddress,
    });
    if (!turnstileValid) return { ok: false, message: TURNSTILE_FAILED_MESSAGE };
  }

  const rateLimit = await consumeAuthRateLimits(
    createReportRateLimitBuckets(session?.userId ?? null, ipAddress),
  );
  if (!rateLimit.allowed) {
    const minutes = Math.max(1, Math.ceil(rateLimit.retryAfterSeconds / 60));
    return {
      ok: false,
      message: `Terlalu banyak laporan dari perangkat ini. Coba lagi dalam ${minutes} menit.`,
    };
  }

  const target = await resolveTarget(values, session?.userId ?? null);
  if (!target.ok) return { ok: false, message: target.message };

  // Alamat balasan: guest memakai yang ia tulis sendiri, user login memakai email
  // akunnya dan hanya bila ia mencentang izinnya. Alamat kiriman client tidak
  // pernah dipakai untuk akun yang sudah login — email akun immutable, jadi
  // snapshot ini tidak akan basi.
  let replyEmail: string | null = null;
  if (session) {
    if (values.useAccountEmail) {
      const user = await prisma.user.findUnique({
        where: { id: session.userId },
        select: { email: true },
      });
      replyEmail = user?.email ?? null;
    }
  } else {
    replyEmail = values.replyEmail ?? null;
  }

  const requestHeaders = await headers();
  const userAgent = requestHeaders.get("user-agent");

  try {
    await prisma.report.create({
      data: {
        ...target.data,
        targetType: values.targetType,
        category: values.category,
        targetLabel: target.targetLabel,
        message: values.message,
        reporterId: session?.userId ?? null,
        replyEmail,
        pagePath: values.pagePath ?? null,
        userAgent: userAgent ? userAgent.slice(0, REPORT_USER_AGENT_MAX_LENGTH) : null,
      },
    });
  } catch (error) {
    // Partial unique index: satu pelapor hanya boleh punya satu laporan OPEN per
    // target. Ini bukan kegagalan yang perlu disembunyikan — justru jawabannya.
    if (error instanceof Prisma.PrismaClientKnownRequestError && error.code === "P2002") {
      return { ok: false, message: DUPLICATE_MESSAGE };
    }
    reportServerError("report.submit_failed", error, { targetType: values.targetType });
    return { ok: false, message: GENERIC_FAILURE_MESSAGE };
  }

  return { ok: true, message: SUCCESS_MESSAGE };
}
