import { z } from "zod";

// Fixture bank soal punya kontrak sendiri yang sudah ditulis sebagai zod schema
// di `prisma/test-package-fixture.mjs` (dipakai `npm run seed:test-package` dan
// didokumentasikan di `docs/seed.md`). Schema itu diimpor apa adanya oleh action
// import — sengaja TIDAK ditulis ulang di sini, karena dua salinan kontrak 400
// baris akan berbeda diam-diam begitu salah satunya diubah.
//
// Yang ada di file ini hanyalah input milik layar admin itu sendiri.

export const ImportTestPackageSchema = z.object({
  // Teks JSON mentah, bukan objek: form hanya memegang string, dan pesan error
  // parse perlu dibedakan dari error kontrak fixture.
  fixtureJson: z.string().trim().min(1, "Tempel isi file JSON fixture."),
  // Nama file hanya label untuk pesan hasil; tidak pernah dipakai membaca disk.
  fileLabel: z.string().trim().max(160),
  // Mengganti paket yang sudah ada. Tetap ditolak server bila paket itu sudah
  // punya attempt — lihat importTestPackage() di prisma/import-test-package.mjs.
  replaceExisting: z.boolean(),
});

export const DeleteTestPackageSchema = z.object({
  id: z.number().int().positive(),
  // Nama paket diketik ulang oleh operator sebagai konfirmasi. Penghapusan
  // merambat ke mondai, soal, pilihan, context, comment, dan attempt.
  confirmName: z.string().trim().min(1),
});

const choiceSchema = z.object({
  id: z.number().int().positive(),
  codeAnswer: z.number().int().min(1).max(4),
  answerText: z.string(),
  answerImage: z.string().trim().max(1000).nullable(),
});

export const UpdateQuestionSchema = z
  .object({
    id: z.number().int().positive(),
    questionText: z.string().max(8000),
    questionImage: z.string().trim().max(1000).nullable(),
    questionAudio: z.string().trim().max(1000).nullable(),
    questionAnswer: z.number().int().min(1).max(4),
    instruction: z.string().trim().max(2000).nullable(),
    choices: z.array(choiceSchema).length(4),
  })
  .superRefine((value, context) => {
    const codes = new Set(value.choices.map((choice) => choice.codeAnswer));
    for (const code of [1, 2, 3, 4]) {
      if (!codes.has(code)) {
        context.addIssue({
          code: "custom",
          path: ["choices"],
          message: `Pilihan ${code} tidak ada.`,
        });
      }
    }
    // Kunci jawaban harus menunjuk pilihan yang benar-benar ada, sama seperti
    // constraint fixture.
    if (!codes.has(value.questionAnswer)) {
      context.addIssue({
        code: "custom",
        path: ["questionAnswer"],
        message: "Kunci jawaban menunjuk pilihan yang tidak ada.",
      });
    }
  });

export type ImportTestPackageInput = z.infer<typeof ImportTestPackageSchema>;
export type DeleteTestPackageInput = z.infer<typeof DeleteTestPackageSchema>;
export type UpdateQuestionInput = z.infer<typeof UpdateQuestionSchema>;
