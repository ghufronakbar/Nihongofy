import "server-only";

import { prisma } from "@/lib/prisma";
import { buildAnonymizedUsername } from "@/lib/username";

export const ANONYMIZED_DISPLAY_NAME = "Pengguna dihapus";

// Penghapusan akun menganonimkan baris User, tidak menghapusnya.
//
// Alasannya bukan kenyamanan: `QuestionComment.userId` dulu memakai
// `onDelete: Cascade`, sehingga satu penghapusan akun ikut memusnahkan setiap
// balasan pengguna lain pada thread milik akun itu. Baris User yang bertahan
// membuat thread tetap utuh, sementara identitas dan data pribadinya hilang.
//
// Yang dulu ikut terhapus oleh cascade sekarang WAJIB dihapus eksplisit di sini.
// Melewatkan satu relasi berarti data pribadi tertinggal di akun yang mengira
// dirinya sudah dihapus.
export async function anonymizeAccount(userId: number) {
  const anonymizedAt = new Date();

  await prisma.$transaction(async (tx) => {
    const current = await tx.user.findUniqueOrThrow({
      where: { id: userId },
      select: { username: true },
    });

    // Handle lama ikut masuk ke username anonim, dan dipotong agar muat dalam
    // batas 30 karakter. Dua handle dengan awalan sama yang dianonimkan pada
    // detik yang sama akan menghasilkan string identik, jadi bentrokannya
    // diselesaikan dengan salt acak — bukan dibiarkan menggagalkan cron.
    let anonymizedUsername = buildAnonymizedUsername(current.username, anonymizedAt);
    for (let attempt = 0; attempt < 10; attempt += 1) {
      const clash = await tx.user.findUnique({
        where: { username: anonymizedUsername },
        select: { id: true },
      });
      if (!clash || clash.id === userId) break;
      anonymizedUsername = buildAnonymizedUsername(
        current.username,
        anonymizedAt,
        Math.random().toString(36).slice(2, 6),
      );
    }

    // Comment tidak dihapus, hanya di-soft delete: root menjadi tombstone dan
    // balasan orang lain di bawahnya tetap terbaca. deletedById menunjuk diri
    // sendiri supaya moderasi tidak salah membacanya sebagai takedown admin.
    await tx.questionComment.updateMany({
      where: { userId, deletedAt: null },
      data: { deletedAt: anonymizedAt, deletedById: userId },
    });

    // Anak dihapus lebih dulu agar tidak bergantung pada urutan cascade.
    await tx.flashcardRevlog.deleteMany({ where: { userId } });
    await tx.flashcardCard.deleteMany({ where: { userId } });
    await tx.flashcardNote.deleteMany({ where: { userId } });
    await tx.flashcardImportJob.deleteMany({ where: { userId } });
    await tx.flashcardDeck.deleteMany({ where: { userId } });
    await tx.flashcardPreset.deleteMany({ where: { userId } });
    await tx.flashcardCollection.deleteMany({ where: { userId } });

    await tx.practiceSession.deleteMany({ where: { userId } });
    await tx.attempt.deleteMany({ where: { userId } });
    await tx.kanaProgress.deleteMany({ where: { userId } });
    await tx.articleInteraction.deleteMany({ where: { userId } });

    await tx.conversationSession.deleteMany({ where: { userId } });
    await tx.conversationQuota.deleteMany({ where: { userId } });

    // Tanpa ini, login Google akan menghidupkan kembali akun yang sudah dihapus
    // lewat provider subject yang masih tertaut.
    await tx.oAuthAccount.deleteMany({ where: { userId } });
    await tx.authToken.deleteMany({ where: { userId } });

    // Laporan sengaja TIDAK dihapus: bug atau typo yang dilaporkan tetap perlu
    // ditindak setelah pelapornya pergi, dan menghapusnya berarti kehilangan
    // pekerjaan yang belum selesai. Yang dibuang adalah identitasnya — tautan
    // pelapor dan alamat balasan, yang merupakan satu-satunya data pribadi di
    // baris ini. `message` ditulis sendiri oleh pelapor tentang konten, bukan
    // tentang dirinya.
    await tx.report.updateMany({
      where: { reporterId: userId },
      data: { reporterId: null, replyEmail: null },
    });

    // Jejak audit admin sengaja DIPERTAHANKAN: itu catatan akuntabilitas atas
    // aksi terhadap konten orang lain, bukan data pribadi si aktor. Yang
    // dibersihkan hanya snapshot namanya; tautan actorId tetap ada dan kini
    // menunjuk baris yang sudah anonim.
    await tx.adminAuditLog.updateMany({
      where: { actorId: userId },
      data: { actorName: ANONYMIZED_DISPLAY_NAME },
    });

    await tx.user.update({
      where: { id: userId },
      data: {
        username: anonymizedUsername,
        displayName: ANONYMIZED_DISPLAY_NAME,
        // Email dikosongkan supaya orangnya dapat mendaftar lagi dengan alamat
        // yang sama, dan supaya tidak ada jalur login yang tersisa. Username
        // lama justru dipertahankan di dalam handle anonim — keputusan produk,
        // lihat `buildAnonymizedUsername`.
        email: null,
        emailVerifiedAt: null,
        password: null,
        avatarUrl: null,
        avatarPublicId: null,
        avatarFormat: null,
        avatarBytes: null,
        allowAudioStorage: false,
        allowConversationStorage: false,
        anonymizedAt,
        // Dikosongkan agar cron tidak memproses ulang baris yang sama.
        deletionScheduledFor: null,
      },
    });
  });
}
