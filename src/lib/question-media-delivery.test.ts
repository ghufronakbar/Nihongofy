import { readFileSync } from "node:fs";
import { fileURLToPath } from "node:url";
import { describe, expect, it } from "vitest";

const QUESTION_MEDIA_RENDERERS = [
  "../components/image-with-lightbox.tsx",
  "../features/exam/components/exam-runner.tsx",
  "../features/practice/components/practice-runner.tsx",
  "../features/question-comment/components/discussion-question-card.tsx",
  "../app/(public)/result/[attemptId]/detail/page.tsx",
  "../app/(public)/test-package/[id]/questions/page.tsx",
];

describe("pengiriman media bank soal", () => {
  it("tidak memakai proxy optimasi gambar Next/Vercel", () => {
    for (const relativePath of QUESTION_MEDIA_RENDERERS) {
      const filePath = fileURLToPath(new URL(relativePath, import.meta.url));
      const source = readFileSync(filePath, "utf8");

      expect(source, relativePath).not.toMatch(/from\s+["']next\/image["']/);
      expect(source, relativePath).not.toContain("/_next/image");
    }
  });

  it("komponen lightbox memakai elemen img native", () => {
    const filePath = fileURLToPath(
      new URL("../components/image-with-lightbox.tsx", import.meta.url),
    );
    expect(readFileSync(filePath, "utf8")).toContain("<img");
  });
});
