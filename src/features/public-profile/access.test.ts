import { describe, expect, it } from "vitest";
import { canViewProfileContent, isProfileUnavailable, profilePath } from "./access";

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
