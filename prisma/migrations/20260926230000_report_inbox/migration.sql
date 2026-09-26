-- Kotak masuk laporan pengguna: bug aplikasi, typo soal, kunci jawaban keliru,
-- penyalahgunaan di diskusi, dan saran. Form-nya publik (guest boleh mengirim),
-- daftarnya hanya terlihat di /admin.
CREATE TYPE "ReportTargetType" AS ENUM (
    'GENERAL',
    'QUESTION',
    'QUESTION_EXPLANATION',
    'ARTICLE',
    'COMMENT'
);

CREATE TYPE "ReportCategory" AS ENUM (
    'BUG',
    'CONTENT_ERROR',
    'ANSWER_KEY',
    'MEDIA_ERROR',
    'EXPLANATION_ERROR',
    'ABUSE',
    'SUGGESTION',
    'OTHER'
);

CREATE TYPE "ReportStatus" AS ENUM (
    'OPEN',
    'IN_REVIEW',
    'RESOLVED',
    'REJECTED',
    'DUPLICATE'
);

CREATE TABLE "Report" (
    "id" SERIAL NOT NULL,
    "targetType" "ReportTargetType" NOT NULL,
    "category" "ReportCategory" NOT NULL,
    "status" "ReportStatus" NOT NULL DEFAULT 'OPEN',
    "questionId" INTEGER,
    "articleId" INTEGER,
    "commentId" INTEGER,
    -- Snapshot teks target supaya baris tetap terbaca setelah FK-nya menjadi
    -- NULL karena targetnya dihapus.
    "targetLabel" VARCHAR(200),
    "message" TEXT NOT NULL,
    "reporterId" INTEGER,
    "pagePath" VARCHAR(200),
    "userAgent" VARCHAR(400),
    "replyEmail" TEXT,
    "repliedAt" TIMESTAMP(3),
    "repliedById" INTEGER,
    "replyMessage" TEXT,
    "handledById" INTEGER,
    "handledAt" TIMESTAMP(3),
    "adminNote" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "Report_pkey" PRIMARY KEY ("id")
);

-- SET NULL di seluruh FK target: menghapus satu soal, artikel, atau komentar
-- tidak boleh ikut menghapus laporan yang belum ditindak. `targetLabel` yang
-- membuat baris sisa itu tetap terbaca.
ALTER TABLE "Report"
    ADD CONSTRAINT "Report_questionId_fkey"
    FOREIGN KEY ("questionId") REFERENCES "Question"("id")
    ON DELETE SET NULL ON UPDATE CASCADE;

ALTER TABLE "Report"
    ADD CONSTRAINT "Report_articleId_fkey"
    FOREIGN KEY ("articleId") REFERENCES "Article"("id")
    ON DELETE SET NULL ON UPDATE CASCADE;

ALTER TABLE "Report"
    ADD CONSTRAINT "Report_commentId_fkey"
    FOREIGN KEY ("commentId") REFERENCES "QuestionComment"("id")
    ON DELETE SET NULL ON UPDATE CASCADE;

-- Pelapor boleh hilang (guest sejak awal, atau akun yang dianonimkan).
ALTER TABLE "Report"
    ADD CONSTRAINT "Report_reporterId_fkey"
    FOREIGN KEY ("reporterId") REFERENCES "User"("id")
    ON DELETE SET NULL ON UPDATE CASCADE;

ALTER TABLE "Report"
    ADD CONSTRAINT "Report_repliedById_fkey"
    FOREIGN KEY ("repliedById") REFERENCES "User"("id")
    ON DELETE SET NULL ON UPDATE CASCADE;

ALTER TABLE "Report"
    ADD CONSTRAINT "Report_handledById_fkey"
    FOREIGN KEY ("handledById") REFERENCES "User"("id")
    ON DELETE SET NULL ON UPDATE CASCADE;

-- Mencegah laporan yang salah kabel: laporan soal tidak boleh membawa
-- articleId, laporan artikel tidak boleh membawa commentId, dan seterusnya.
--
-- Perhatikan bahwa sisi "harus ada" sengaja TIDAK ada di sini. FK target memakai
-- ON DELETE SET NULL, jadi CHECK yang mewajibkan `questionId IS NOT NULL` untuk
-- targetType 'QUESTION' akan menggagalkan penghapusan soal itu sendiri.
-- Kewajiban mengisi target saat laporan dibuat ditegakkan zod di
-- `src/features/report/schemas.ts`.
ALTER TABLE "Report"
    ADD CONSTRAINT "Report_target_columns_check" CHECK (
        ("targetType" IN ('QUESTION', 'QUESTION_EXPLANATION') OR "questionId" IS NULL)
        AND ("targetType" = 'ARTICLE' OR "articleId" IS NULL)
        AND ("targetType" = 'COMMENT' OR "commentId" IS NULL)
    );

-- Balasan hanya boleh tercatat lengkap atau tidak ada sama sekali: baris dengan
-- `repliedAt` tetapi tanpa isi balasan berarti ada email terkirim tanpa jejak.
ALTER TABLE "Report"
    ADD CONSTRAINT "Report_reply_shape_check" CHECK (
        ("repliedAt" IS NULL AND "replyMessage" IS NULL)
        OR ("repliedAt" IS NOT NULL AND "replyMessage" IS NOT NULL)
    );

-- Antrean utama: satu status, terbaru dulu.
CREATE INDEX "Report_status_createdAt_idx" ON "Report"("status", "createdAt");
-- Tab per jenis target.
CREATE INDEX "Report_targetType_status_idx" ON "Report"("targetType", "status");
CREATE INDEX "Report_questionId_idx" ON "Report"("questionId");
CREATE INDEX "Report_articleId_idx" ON "Report"("articleId");
CREATE INDEX "Report_commentId_idx" ON "Report"("commentId");
CREATE INDEX "Report_reporterId_idx" ON "Report"("reporterId");
CREATE INDEX "Report_handledById_idx" ON "Report"("handledById");
CREATE INDEX "Report_repliedById_idx" ON "Report"("repliedById");

-- Satu pelapor tidak boleh membanjiri satu target dengan laporan terbuka yang
-- sama. Partial index: hanya berlaku untuk laporan yang masih OPEN dan pelapor
-- yang dikenal — guest tidak punya identitas yang dapat dijadikan kunci, dan di
-- sana rate limit per IP yang bekerja.
CREATE UNIQUE INDEX "Report_open_question_per_reporter_key"
    ON "Report"("reporterId", "targetType", "questionId")
    WHERE "status" = 'OPEN' AND "reporterId" IS NOT NULL AND "questionId" IS NOT NULL;

CREATE UNIQUE INDEX "Report_open_article_per_reporter_key"
    ON "Report"("reporterId", "articleId")
    WHERE "status" = 'OPEN' AND "reporterId" IS NOT NULL AND "articleId" IS NOT NULL;

CREATE UNIQUE INDEX "Report_open_comment_per_reporter_key"
    ON "Report"("reporterId", "commentId")
    WHERE "status" = 'OPEN' AND "reporterId" IS NOT NULL AND "commentId" IS NOT NULL;

-- Hanya diakses server-side lewat Prisma, seperti seluruh tabel aplikasi.
REVOKE ALL PRIVILEGES ON TABLE "Report" FROM anon, authenticated, service_role;
ALTER TABLE "Report" ENABLE ROW LEVEL SECURITY;
