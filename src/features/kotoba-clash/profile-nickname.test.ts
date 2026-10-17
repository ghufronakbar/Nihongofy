import { describe, expect, it } from "vitest";
import { clashProfileNickname } from "./profile-nickname";
import { ClashNicknameSchema } from "./schemas";

describe("profile nickname defaults", () => {
  it("preserves valid names and adapts names that exceed room input constraints", () => {
    expect(clashProfileNickname("Profile Name")).toBe("Profile Name");
    expect(clashProfileNickname("  Ａｋｉ 🌸  Tanaka  ")).toBe("Aki Tanaka");
    const longName = clashProfileNickname("A long profile display name that exceeds the room nickname limit");
    expect(longName.length).toBeLessThanOrEqual(24);
    expect(ClashNicknameSchema.safeParse(longName).success).toBe(true);
    expect(clashProfileNickname(null)).toBe("");
    expect(clashProfileNickname("🌸")).toBe("");
    expect(ClashNicknameSchema.safeParse(clashProfileNickname("A" + "𠮷".repeat(15))).success).toBe(true);
  });
});
