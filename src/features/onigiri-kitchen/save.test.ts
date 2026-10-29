import { describe, expect, it } from "vitest";
import { buyUpgrade, rewardQuest, startGame, tickGame } from "./domain";
import { activeQuests } from "./progression";
import { parseSave, restoreSave, saveSnapshot } from "./save";

describe("Kitchen local progress", () => {
  it("round-trips coins, upgrades, quest rewards and all food without carrying over transient customers", () => {
    const game = startGame();
    game.score = 3000;
    game.served = 1;
    game.revenue = 130;
    game.dishTotals.onigiri = 1;
    game.learned = ["onigiri"];
    rewardQuest(game, "welcome");
    buyUpgrade(game, "waiter");
    buyUpgrade(game, "waiter");
    buyUpgrade(game, "expansion");
    buyUpgrade(game, "stove");
    game.carrying = "ocha";
    game.readyDishes = ["tamago"];
    game.waiters[0].carrying = "onigiri";
    game.waiters[0].target = 1;
    game.waiters[1].carrying = "ocha";
    const snapshot = saveSnapshot(game);
    const parsed = parseSave(JSON.parse(JSON.stringify(snapshot)) as unknown);
    expect(parsed).not.toBeNull();
    if (!parsed) throw new Error("Expected a valid save");
    const restored = restoreSave(parsed);
    expect(restored.phase).toBe("ready");
    expect(restored.score).toBe(game.score);
    expect(restored.revenue).toBe(130);
    expect(restored.upgrades).toEqual(game.upgrades);
    expect(restored.carrying).toBe("ocha");
    expect(restored.readyDishes).toEqual(["tamago", "onigiri", "ocha"]);
    expect(restored.waiters).toHaveLength(2);
    expect(
      restored.waiters.every(
        (waiter) => waiter.carrying === null && waiter.target === null,
      ),
    ).toBe(true);
    expect(activeQuests(restored).some((quest) => quest.id === "welcome")).toBe(
      false,
    );
    restored.phase = "playing";
    expect(rewardQuest(restored, "welcome")).toBe(false);
    const balance = restored.score;
    expect(restored.elapsed).toBe(0);
    restored.phase = "ready";
    tickGame(restored, 60);
    expect(restored.elapsed).toBe(0);
    expect(restored.score).toBe(balance);
    // Saved data is a separate snapshot rather than a reference to the live game.
    restored.upgrades.stove++;
    expect(game.upgrades.stove).toBe(1);
  });

  it.each([null, "invalid json", { version: 1 }, { version: 2, progress: {} }])(
    "rejects malformed local data: %j",
    (value) => {
      expect(parseSave(value)).toBeNull();
    },
  );

  it("rejects invalid balances, unknown menu ids, excess food and duplicate quest rewards", () => {
    const saved = saveSnapshot(startGame());
    expect(
      parseSave({ ...saved, progress: { ...saved.progress, score: -1 } }),
    ).toBeNull();
    expect(parseSave({ ...saved, carrying: "sushi" })).toBeNull();
    expect(
      parseSave({ ...saved, queue: ["ocha", "ocha", "ocha", "ocha"] }),
    ).toBeNull();
    expect(
      parseSave({
        ...saved,
        progress: { ...saved.progress, questClaimed: ["welcome", "welcome"] },
      }),
    ).toBeNull();
    expect(
      parseSave({
        ...saved,
        progress: {
          ...saved.progress,
          upgrades: { ...saved.progress.upgrades, waiter: 3 },
        },
      }),
    ).toBeNull();
    expect(
      parseSave({
        ...saved,
        progress: { ...saved.progress, learned: ["ocha", "ocha"] },
      }),
    ).toBeNull();
    expect(
      parseSave({
        ...saved,
        progress: {
          ...saved.progress,
          questCycle: 1,
          questClaimed: ["welcome"],
        },
      }),
    ).toBeNull();
  });
});
