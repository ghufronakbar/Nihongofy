import { describe, expect, it } from "vitest";
import {
  canViewProfileContent,
  initialFollowStatus,
  isProfileUnavailable,
  profilePath,
} from "./access";

const owner = { id: 7, profileVisibility: "PUBLIC" as const };

describe("canViewProfileContent", () => {
  it("akun public terlihat oleh guest dan user lain", () => {
    expect(canViewProfileContent(owner, null)).toBe(true);
    expect(canViewProfileContent(owner, 99)).toBe(true);
  });

  it("akun private hanya terlihat oleh pemiliknya", () => {
    const privateOwner = { ...owner, profileVisibility: "PRIVATE" as const };
    expect(canViewProfileContent(privateOwner, null)).toBe(false);
    expect(canViewProfileContent(privateOwner, 99)).toBe(false);
    expect(canViewProfileContent(privateOwner, 7)).toBe(true);
  });

  it("follower yang disetujui boleh melihat akun private, permintaan PENDING tidak", () => {
    const privateOwner = { ...owner, profileVisibility: "PRIVATE" as const };
    expect(canViewProfileContent(privateOwner, 99, "ACCEPTED")).toBe(true);
    expect(canViewProfileContent(privateOwner, 99, "PENDING")).toBe(false);
  });
});

describe("initialFollowStatus", () => {
  it("akun public langsung diterima, akun private menunggu persetujuan", () => {
    expect(initialFollowStatus("PUBLIC")).toBe("ACCEPTED");
    expect(initialFollowStatus("PRIVATE")).toBe("PENDING");
  });
});

describe("isProfileUnavailable", () => {
  it("akun aktif tersedia", () => {
    expect(isProfileUnavailable({ anonymizedAt: null, deletionRequestedAt: null })).toBe(false);
  });

  it("akun anonim dan akun yang menunggu penghapusan tidak punya profil", () => {
    expect(isProfileUnavailable({ anonymizedAt: new Date(), deletionRequestedAt: null })).toBe(true);
    expect(isProfileUnavailable({ anonymizedAt: null, deletionRequestedAt: new Date() })).toBe(true);
  });
});

describe("profilePath", () => {
  it("membentuk /u/<username>", () => {
    expect(profilePath("lans.prodigy", true)).toBe("/u/lans.prodigy");
  });

  it("null bila flag mati atau akun anonim", () => {
    expect(profilePath("lans", false)).toBeNull();
    expect(profilePath("lans_1761400000_deleted", true)).toBeNull();
  });
});
