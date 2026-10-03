import { afterEach, beforeEach, describe, expect, it, vi, type Mock } from "vitest";
import type { DeleteTestPackageInput, ImportTestPackageInput } from "./schemas";

// Aksi destruktif bank soal diuji dengan Prisma tiruan; tidak ada koneksi
// database. `prisma/import-test-package.mjs` dan kontrak fixture dipakai apa
// adanya, karena keduanya bagian dari perilaku yang dijanjikan action import.
//
// Prisma tiruan memisahkan tulisan "langsung" (`prisma.*`) dari tulisan di dalam
// transaksi (`tx.*`). Tulisan transaksi baru dianggap tersimpan bila callback
// `$transaction` selesai tanpa error — meniru rollback — sehingga tulisan
// sebagian yang lolos dari transaksi akan terlihat di `committed`.

type Write = { model: string; method: string; args: unknown };

const mocks = vi.hoisted(() => ({
  requireAdmin: vi.fn(),
  updateTag: vi.fn(),
  committed: [] as { model: string; method: string; args: unknown }[],
  // Isi tabel yang dibaca transaksi import: paket bernama sama yang sudah ada.
  existingPackages: [] as unknown[],
  directFindUnique: vi.fn(),
  failOn: null as string | null,
}));

vi.mock("server-only", () => ({}));
vi.mock("@/lib/server-logger", () => ({ reportServerError: vi.fn() }));
vi.mock("@/lib/auth", () => ({ requireAdmin: mocks.requireAdmin }));
vi.mock("next/navigation", () => ({
  notFound: () => {
    throw new Error("NEXT_NOT_FOUND");
  },
}));
vi.mock("next/cache", () => ({ updateTag: mocks.updateTag }));

vi.mock("@/lib/prisma", () => {
  let nextId = 1000;

  function writer(target: Write[], model: string, method: string) {
    return vi.fn(async (args: unknown) => {
      if (mocks.failOn === `${model}.${method}`) throw new Error(`gagal di ${model}.${method}`);
      target.push({ model, method, args });
      const data =
        typeof args === "object" && args !== null && "data" in args ? args.data : undefined;
      const rows: unknown[] = Array.isArray(data) ? data : [];
      if (method === "createManyAndReturn") {
        return rows.map((row) => ({
          ...(typeof row === "object" && row !== null ? row : {}),
          id: (nextId += 1),
        }));
      }
      if (method === "createMany") return { count: rows.length };
      return { id: (nextId += 1) };
    });
  }

  function client(target: Write[]): Record<string, Record<string, unknown>> {
    const models = [
      "testPackage",
      "testPackageItem",
      "question",
      "questionChoice",
      "questionContext",
      "questionExplanation",
      "questionExplanationChoice",
      "adminAuditLog",
    ];
    const methods = ["create", "createMany", "createManyAndReturn", "update", "delete", "deleteMany"];
    return Object.fromEntries(
      models.map((model) => [
        model,
        Object.fromEntries(methods.map((method) => [method, writer(target, model, method)])),
      ]),
    );
  }

  const direct = client(mocks.committed);
  const prisma = {
    ...direct,
    testPackage: { ...direct.testPackage, findUnique: mocks.directFindUnique },
    $transaction: vi.fn(async (fn: (tx: object) => Promise<unknown>) => {
      const staged: Write[] = [];
      const transactional = client(staged);
      const tx = {
        ...transactional,
        $queryRaw: vi.fn(async () => [{ locked: 1 }]),
        testPackage: {
          ...transactional.testPackage,
          findMany: vi.fn(async () => mocks.existingPackages),
        },
      };
      const result = await fn(tx);
      mocks.committed.push(...staged);
      return result;
    }),
  };
  return { prisma };
});

import { prisma } from "@/lib/prisma";
import { CACHE_TAGS } from "@/constants/cache-key";
import { deleteTestPackageAction, importTestPackageAction } from "./actions";

const ADMIN = {
  userId: 1,
  sessionId: "sesi",
  user: { id: 1, displayName: "Admin Satu", avatarUrl: null, role: "ADMIN" },
};

// Fixture terkecil yang memenuhi kontrak: satu mondai N2 berisi satu soal.
function fixture(overrides: { questionAnswer?: number; session?: number } = {}) {
  return {
    name: "JLPT N2 - Uji",
    jlptLevel: "N2",
    testPackageItems: [
      {
        mondaiType: "MOJI_GOI_READ_KANJI",
        section: "MOJI_GOI",
        session: overrides.session ?? 1,
        order: 1,
        instruction: "問題1",
        questions: [
          {
            order: 1,
            questionText: "__{人脈|じんみゃく}__を広げる。",
            questionAnswer: overrides.questionAnswer ?? 2,
            explanation: "Cara baca 人脈 adalah じんみゃく.",
            questionChoices: [1, 2, 3, 4].map((codeAnswer) => ({
              codeAnswer,
              answerText: ["じんみ", "じんみゃく", "にんみゃく", "じんめい"][codeAnswer - 1]!,
            })),
          },
        ],
      },
    ],
  };
}

function importInput(overrides: Partial<ImportTestPackageInput> = {}): ImportTestPackageInput {
  return {
    fixtureJson: JSON.stringify(fixture()),
    fileLabel: "n2-uji.json",
    replaceExisting: false,
    ...overrides,
  };
}

function existingPackage(attempts: number) {
  return {
    id: 50,
    jlptLevel: "N2",
    _count: { questionContexts: 0, attempts },
    testPackageItems: [
      { mondaiType: "MOJI_GOI_READ_KANJI", section: "MOJI_GOI", session: 1, order: 1, _count: { questions: 1 } },
    ],
  };
}

function committedModels() {
  return mocks.committed.map((write) => `${write.model}.${write.method}`);
}

function auditRows() {
  return mocks.committed
    .filter((write) => write.model === "adminAuditLog")
    .map((write) => (write.args as { data: Record<string, unknown> }).data);
}

beforeEach(() => {
  mocks.requireAdmin.mockResolvedValue(ADMIN);
  mocks.committed.length = 0;
  mocks.existingPackages = [];
  mocks.failOn = null;
});

afterEach(() => {
  vi.clearAllMocks();
});

describe("importTestPackageAction", () => {
  it("non-admin ditolak 404 sebelum menyentuh database", async () => {
    mocks.requireAdmin.mockRejectedValue(new Error("NEXT_NOT_FOUND"));

    await expect(importTestPackageAction(importInput())).rejects.toThrow("NEXT_NOT_FOUND");
    expect(prisma.$transaction).not.toHaveBeenCalled();
    expect(mocks.committed).toEqual([]);
  });

  it("input form yang tidak valid ditolak zod", async () => {
    for (const input of [
      importInput({ fixtureJson: "   " }),
      { ...importInput(), replaceExisting: "ya" } as unknown as ImportTestPackageInput,
      { ...importInput(), fileLabel: "x".repeat(161) },
    ]) {
      const result = await importTestPackageAction(input);
      expect(result.ok).toBe(false);
    }
    expect(prisma.$transaction).not.toHaveBeenCalled();
  });

  it("JSON rusak dan fixture yang melanggar kontrak ditolak tanpa satu tulisan pun", async () => {
    const broken = await importTestPackageAction(importInput({ fixtureJson: "{ bukan json" }));
    expect(broken).toMatchObject({ ok: false });
    expect(broken.ok ? "" : broken.message).toMatch(/JSON tidak dapat dibaca/);

    // Kunci jawaban yang tidak ada di pilihan, dan session yang salah untuk N2.
    for (const invalid of [fixture({ questionAnswer: 5 }), fixture({ session: 2 })]) {
      const result = await importTestPackageAction(importInput({ fixtureJson: JSON.stringify(invalid) }));
      expect(result).toMatchObject({ ok: false });
      expect(result.ok ? [] : result.issues).not.toHaveLength(0);
    }

    expect(prisma.$transaction).not.toHaveBeenCalled();
    expect(mocks.committed).toEqual([]);
    expect(mocks.updateTag).not.toHaveBeenCalled();
  });

  it("paket baru ditulis dalam satu transaksi, dicatat audit, dan cache publik diinvalidasi", async () => {
    const result = await importTestPackageAction(importInput());

    expect(result).toMatchObject({ ok: true, status: "seeded" });
    expect(prisma.$transaction).toHaveBeenCalledOnce();
    expect(committedModels()).toEqual(
      expect.arrayContaining([
        "testPackage.create",
        "testPackageItem.createManyAndReturn",
        "question.createManyAndReturn",
        "questionChoice.createMany",
        "questionExplanation.createManyAndReturn",
      ]),
    );

    const packageId = result.ok ? result.packageId! : -1;
    expect(auditRows()).toEqual([
      expect.objectContaining({
        actorId: 1,
        actorName: "Admin Satu",
        action: "test-package.import",
        targetType: "test-package",
        targetId: String(packageId),
      }),
    ]);
    // Summary tidak memuat isi soal.
    expect(String(auditRows()[0]!.summary)).not.toContain("人脈");

    const tags = mocks.updateTag.mock.calls.map(([tag]) => tag);
    expect(tags).toEqual(
      expect.arrayContaining([
        CACHE_TAGS.testPackageList,
        CACHE_TAGS.practiceCatalog,
        CACHE_TAGS.testPackageDetail(packageId),
        CACHE_TAGS.testPackageQuestions(packageId),
      ]),
    );
  });

  it("kegagalan di tengah import membatalkan seluruh tulisan, tanpa audit dan invalidasi", async () => {
    mocks.failOn = "questionChoice.createMany";

    await expect(importTestPackageAction(importInput())).rejects.toThrow("gagal di questionChoice");
    expect(mocks.committed).toEqual([]);
    expect(mocks.updateTag).not.toHaveBeenCalled();
  });

  it("replacement ditolak bila paket lama sudah punya attempt", async () => {
    mocks.existingPackages = [existingPackage(3)];

    const result = await importTestPackageAction(importInput({ replaceExisting: true }));

    expect(result).toMatchObject({ ok: false });
    expect(result.ok ? "" : result.message).toMatch(/3 attempt/);
    expect(mocks.committed).toEqual([]);
    expect(mocks.updateTag).not.toHaveBeenCalled();
  });

  it("paket yang sudah ada tidak diganti tanpa replaceExisting", async () => {
    mocks.existingPackages = [existingPackage(0)];

    const result = await importTestPackageAction(importInput());

    expect(result).toMatchObject({ ok: true, status: "skipped", packageId: 50 });
    expect(mocks.committed).toEqual([]);
    expect(mocks.updateTag).not.toHaveBeenCalled();
  });

  it("replacement paket tanpa attempt menghapus lalu menulis ulang di transaksi yang sama", async () => {
    mocks.existingPackages = [existingPackage(0)];

    const result = await importTestPackageAction(importInput({ replaceExisting: true }));

    expect(result).toMatchObject({ ok: true, status: "replaced" });
    expect(prisma.$transaction).toHaveBeenCalledOnce();
    expect(committedModels().slice(0, 2)).toEqual(["testPackage.delete", "testPackage.create"]);
    // Cache paket lama ikut diinvalidasi, bukan hanya paket barunya.
    const tags = mocks.updateTag.mock.calls.map(([tag]) => tag);
    expect(tags).toContain(CACHE_TAGS.testPackageQuestions(50));
  });
});

describe("deleteTestPackageAction", () => {
  const findPackage = mocks.directFindUnique as Mock;
  const input = (overrides: Partial<DeleteTestPackageInput> = {}): DeleteTestPackageInput => ({
    id: 50,
    confirmName: "JLPT N2 - Uji",
    ...overrides,
  });

  it("non-admin ditolak 404 sebelum menyentuh database", async () => {
    mocks.requireAdmin.mockRejectedValue(new Error("NEXT_NOT_FOUND"));

    await expect(deleteTestPackageAction(input())).rejects.toThrow("NEXT_NOT_FOUND");
    expect(findPackage).not.toHaveBeenCalled();
    expect(prisma.$transaction).not.toHaveBeenCalled();
  });

  it("input yang tidak valid ditolak zod", async () => {
    for (const invalid of [input({ id: 0 }), input({ confirmName: "  " })]) {
      expect(await deleteTestPackageAction(invalid)).toEqual({ ok: false, message: "Data tidak valid." });
    }
    expect(findPackage).not.toHaveBeenCalled();
  });

  it("paket yang tidak ada berakhir 404", async () => {
    findPackage.mockResolvedValue(null);

    await expect(deleteTestPackageAction(input())).rejects.toThrow("NEXT_NOT_FOUND");
    expect(prisma.$transaction).not.toHaveBeenCalled();
  });

  it("nama konfirmasi yang tidak cocok membatalkan penghapusan", async () => {
    findPackage.mockResolvedValue({ id: 50, name: "JLPT N2 - Uji", _count: { attempts: 0 } });

    const result = await deleteTestPackageAction(input({ confirmName: "JLPT N2" }));

    expect(result).toMatchObject({ ok: false });
    expect(prisma.$transaction).not.toHaveBeenCalled();
  });

  it("paket yang punya attempt ditolak supaya hasil pengerjaan user tidak ikut terhapus", async () => {
    findPackage.mockResolvedValue({ id: 50, name: "JLPT N2 - Uji", _count: { attempts: 2 } });

    const result = await deleteTestPackageAction(input());

    expect(result).toMatchObject({ ok: false });
    expect(result.ok ? "" : result.message).toMatch(/2 attempt/);
    expect(prisma.$transaction).not.toHaveBeenCalled();
    expect(mocks.committed).toEqual([]);
  });

  it("paket tanpa attempt dihapus bersama audit di satu transaksi, lalu cache diinvalidasi", async () => {
    findPackage.mockResolvedValue({ id: 50, name: "JLPT N2 - Uji", _count: { attempts: 0 } });

    expect(await deleteTestPackageAction(input())).toEqual({ ok: true });

    expect(prisma.$transaction).toHaveBeenCalledOnce();
    // Penghapusan lewat tx, bukan klien global di luar transaksi.
    expect(prisma.testPackage.delete).not.toHaveBeenCalled();
    expect(mocks.committed[0]).toEqual({
      model: "testPackage",
      method: "delete",
      args: { where: { id: 50 } },
    });
    expect(auditRows()).toEqual([
      expect.objectContaining({ actorId: 1, action: "test-package.delete", targetId: "50" }),
    ]);

    const tags = mocks.updateTag.mock.calls.map(([tag]) => tag);
    expect(tags).toEqual(
      expect.arrayContaining([
        CACHE_TAGS.testPackageList,
        CACHE_TAGS.practiceCatalog,
        CACHE_TAGS.testPackageDetail(50),
        CACHE_TAGS.testPackageQuestions(50),
      ]),
    );
  });
});
