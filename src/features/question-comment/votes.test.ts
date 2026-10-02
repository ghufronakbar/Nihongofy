import { readFileSync } from "node:fs";
import { fileURLToPath } from "node:url";
import { describe, expect, it } from "vitest";
import { sortDiscussionRoots, voteRejection, type VoteTarget } from "./votes";

const liveRoot: VoteTarget["root"] = {
  visibility: "PUBLIC",
  sharedAt: new Date("2026-10-01"),
  deletedAt: null,
};

function target(overrides: Partial<VoteTarget> = {}): VoteTarget {
  return { authorId: 2, deletedAt: null, root: liveRoot, ...overrides };
}

describe("voteRejection", () => {
  it("entri publik milik orang lain boleh diberi suara", () => {
    expect(voteRejection(target(), 1)).toBeNull();
  });

  it("catatan sendiri ditolak", () => {
    expect(voteRejection(target({ authorId: 1 }), 1)).toBe("own");
  });

  it("catatan privat yang belum pernah dibagikan ditolak", () => {
    expect(
      voteRejection(target({ root: { visibility: "PRIVATE", sharedAt: null, deletedAt: null } }), 1),
    ).toBe("unavailable");
  });

  it("tombstone — root dihapus atau disembunyikan — ditolak", () => {
    expect(
      voteRejection(target({ root: { ...liveRoot, deletedAt: new Date() } }), 1),
    ).toBe("unavailable");
    expect(voteRejection(target({ root: { ...liveRoot, visibility: "PRIVATE" } }), 1)).toBe(
      "unavailable",
    );
  });

  it("balasan yang dihapus ditolak; balasan hidup di thread hidup boleh", () => {
    expect(voteRejection(target({ deletedAt: new Date() }), 1)).toBe("unavailable");
    expect(voteRejection(target(), 1)).toBeNull();
  });

  it("entri yang tidak tersedia ditolak sebagai unavailable, bukan own", () => {
    // Pemilik tidak boleh mengetahui keberadaan entri tersembunyi lewat pesan berbeda.
    expect(voteRejection(target({ authorId: 1, deletedAt: new Date() }), 1)).toBe("unavailable");
  });
});

describe("sortDiscussionRoots", () => {
  const roots = [
    { id: 1, voteCount: 0, createdAt: new Date("2026-10-03") },
    { id: 2, voteCount: 5, createdAt: new Date("2026-10-01") },
    { id: 3, voteCount: 5, createdAt: new Date("2026-10-02") },
    { id: 4, voteCount: 1, createdAt: new Date("2026-09-30") },
  ];

  it("Terbaru mempertahankan urutan query", () => {
    expect(sortDiscussionRoots(roots, "newest").map((root) => root.id)).toEqual([1, 2, 3, 4]);
  });

  it("Paling membantu: suara terbanyak dulu, seri dipecah yang terbaru", () => {
    expect(sortDiscussionRoots(roots, "helpful").map((root) => root.id)).toEqual([3, 2, 4, 1]);
  });

  it("tidak mengubah array asal", () => {
    sortDiscussionRoots(roots, "helpful");
    expect(roots.map((root) => root.id)).toEqual([1, 2, 3, 4]);
  });
});

// Thread dirender server dan diindeks. Siapa yang memberi suara tidak boleh ikut
// terkirim: query suara di layer thread hanya boleh memilih `commentId` (status
// viewer) atau menghitung (`groupBy`), tidak pernah `userId`.
describe("privasi suara", () => {
  const source = readFileSync(fileURLToPath(new URL("./queries.ts", import.meta.url)), "utf8");

  it("query suara tidak pernah memilih userId pemberi suara", () => {
    const calls = [...source.matchAll(/prisma\.questionCommentVote\.(\w+)\(\{([\s\S]*?)\}\);/g)];
    expect(calls.length).toBeGreaterThan(0);
    for (const [, method, body] of calls) {
      expect(["groupBy", "findMany"]).toContain(method);
      if (method === "findMany") {
        expect(body).toMatch(/select:\s*\{\s*commentId:\s*true\s*\}/);
        // Hanya suara milik viewer sendiri yang dibaca per baris.
        expect(body).toMatch(/where:\s*\{\s*userId:\s*viewerId/);
      }
    }
  });
});
