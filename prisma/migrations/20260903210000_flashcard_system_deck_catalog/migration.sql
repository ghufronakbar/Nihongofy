-- Katalog deck bawaan aplikasi. Tidak punya `userId`: ini konten sumber, bukan
-- koleksi yang dijadwalkan. Menambahkan deck bawaan berarti meng-COPY isinya ke
-- koleksi user, sehingga setelah itu deck sepenuhnya milik user tersebut.

-- AlterEnum
ALTER TYPE "FlashcardNoteTypeKind" ADD VALUE 'KANA';

-- CreateTable
CREATE TABLE "FlashcardSystemDeck" (
    "id" SERIAL NOT NULL,
    "slug" VARCHAR(120) NOT NULL,
    "name" VARCHAR(500) NOT NULL,
    "description" TEXT NOT NULL DEFAULT '',
    "jlptLevel" "JlptLevel",
    "noteType" "FlashcardNoteTypeKind" NOT NULL,
    "license" VARCHAR(300) NOT NULL,
    "order" INTEGER NOT NULL DEFAULT 0,
    "isPublished" BOOLEAN NOT NULL DEFAULT true,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "FlashcardSystemDeck_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "FlashcardSystemNote" (
    "id" SERIAL NOT NULL,
    "deckId" INTEGER NOT NULL,
    "guid" VARCHAR(64) NOT NULL,
    "fields" TEXT[],
    "tags" TEXT[],
    "order" INTEGER NOT NULL DEFAULT 0,

    CONSTRAINT "FlashcardSystemNote_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE UNIQUE INDEX "FlashcardSystemDeck_slug_key" ON "FlashcardSystemDeck"("slug");
CREATE INDEX "FlashcardSystemDeck_isPublished_order_idx" ON "FlashcardSystemDeck"("isPublished", "order");
CREATE UNIQUE INDEX "FlashcardSystemNote_deckId_guid_key" ON "FlashcardSystemNote"("deckId", "guid");
CREATE INDEX "FlashcardSystemNote_deckId_order_idx" ON "FlashcardSystemNote"("deckId", "order");

-- AddForeignKey
ALTER TABLE "FlashcardSystemNote" ADD CONSTRAINT "FlashcardSystemNote_deckId_fkey" FOREIGN KEY ("deckId") REFERENCES "FlashcardSystemDeck"("id") ON DELETE CASCADE ON UPDATE CASCADE;
