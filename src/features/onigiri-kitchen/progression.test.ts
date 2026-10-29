import { describe, expect, it } from "vitest";
import {
  activeQuests,
  claimQuest,
  createProgression,
  purchaseUpgrade,
  upgradeCost,
} from "./progression";

describe("Kitchen quests", () => {
  it("only rewards completed active quests once and keeps income separate from rewards", () => {
    const progress = createProgression();
    expect(activeQuests(progress).map((quest) => quest.id)).toEqual([
      "welcome",
      "tasting",
      "combo",
    ]);
    expect(claimQuest(progress, "welcome")).toBeNull();
    progress.served = 1;
    progress.upgrades.stove = 1;
    expect(claimQuest(progress, "stove")).toBeNull();
    expect(claimQuest(progress, "welcome")?.reward).toBe(100);
    expect(progress.score).toBe(100);
    expect(progress.revenue).toBe(0);
    expect(claimQuest(progress, "welcome")).toBeNull();
    expect(progress.score).toBe(100);
    expect(activeQuests(progress).map((quest) => quest.id)).toEqual([
      "tasting",
      "combo",
      "stove",
    ]);
    expect(claimQuest(progress, "stove")?.reward).toBe(140);
  });

  it("counts all three menu types rather than the number of dishes for the tasting quest", () => {
    const progress = createProgression();
    progress.dishTotals.onigiri = 12;
    expect(
      activeQuests(progress).find((quest) => quest.id === "tasting")?.progress,
    ).toBe(1);
    progress.dishTotals.tamago = 1;
    progress.dishTotals.ocha = 1;
    expect(claimQuest(progress, "tasting")?.reward).toBe(160);
  });

  it("moves from varied introductory quests to renewable contracts with new baselines", () => {
    const progress = createProgression();
    Object.assign(progress, {
      served: 20,
      quickServed: 5,
      vipServed: 3,
      waiterServed: 4,
      revenue: 3100,
      bestCombo: 4,
      dishTotals: { onigiri: 10, tamago: 6, ocha: 8 },
      upgrades: { stove: 1, shoes: 0, decor: 1, waiter: 1, expansion: 2 },
    });
    const completed = new Set<string>();
    for (let index = 0; index < 15; index++) {
      const quest = activeQuests(progress)[0];
      completed.add(quest.id);
      expect(claimQuest(progress, quest.id)).not.toBeNull();
    }
    expect(completed.size).toBe(15);
    expect(progress.questCycle).toBe(1);
    expect(progress.questClaimed).toEqual([]);
    expect(progress.questBaseline.served).toBe(20);
    expect(activeQuests(progress).map((quest) => quest.progress)).toEqual([
      0, 0, 0,
    ]);
    expect(
      activeQuests(progress).find((quest) => quest.id === "special")?.title,
    ).toContain("Onigiri");
    expect(claimQuest(progress, "regulars")).toBeNull();
    progress.served += 5;
    progress.dishTotals.onigiri += 5;
    progress.vipServed += 2;
    for (const id of ["regulars", "special", "vip"])
      expect(claimQuest(progress, id)).not.toBeNull();
    expect(progress.questCycle).toBe(2);
    expect(activeQuests(progress).map((quest) => quest.progress)).toEqual([
      0, 0, 0,
    ]);
    expect(activeQuests(progress).map((quest) => quest.id)).toEqual([
      "regulars",
      "special",
      "team",
    ]);
    expect(
      activeQuests(progress).find((quest) => quest.id === "special")?.title,
    ).toContain("Tamago");
    progress.dishTotals.tamago++;
    expect(progress.questBaseline.dishTotals.tamago).toBe(6);
  });
});

describe("Kitchen purchases", () => {
  it("rejects insufficient funds and max levels without charging or changing sales", () => {
    const progress = createProgression();
    progress.score = 219;
    progress.revenue = 500;
    expect(upgradeCost(progress, "stove")).toBe(220);
    expect(purchaseUpgrade(progress, "stove")).toBe(false);
    expect(progress.score).toBe(219);
    expect(progress.upgrades.stove).toBe(0);
    progress.score = 2000;
    for (const cost of [220, 480, 850]) {
      const balance = progress.score;
      expect(upgradeCost(progress, "stove")).toBe(cost);
      expect(purchaseUpgrade(progress, "stove")).toBe(true);
      expect(progress.score).toBe(balance - cost);
    }
    expect(upgradeCost(progress, "stove")).toBeNull();
    const balance = progress.score;
    expect(purchaseUpgrade(progress, "stove")).toBe(false);
    expect(progress.upgrades.stove).toBe(3);
    expect(progress.score).toBe(balance);
    expect(progress.revenue).toBe(500);
  });
});
