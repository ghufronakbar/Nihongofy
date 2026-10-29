import { z } from "zod";
import { startGame, type GameState } from "./domain";
import type { Progression } from "./progression";

export const KITCHEN_SAVE_KEY = "nihongofy:onigiri-kitchen:progress:v2";
const count = z.number().int().min(0).max(1_000_000_000);
const food = z.enum(["onigiri", "tamago", "ocha"]);
const metricsSchema = z.object({
  served: count,
  revenue: count,
  quickServed: count,
  vipServed: count,
  waiterServed: count,
  dishTotals: z.object({ onigiri: count, tamago: count, ocha: count }),
});
const progressSchema = metricsSchema
  .extend({
    score: count,
    missed: count,
    bestCombo: count,
    learned: z
      .array(food)
      .max(3)
      .refine((ids) => new Set(ids).size === ids.length),
    upgrades: z.object({
      stove: z.number().int().min(0).max(3),
      shoes: z.number().int().min(0).max(2),
      decor: z.number().int().min(0).max(2),
      waiter: z.number().int().min(0).max(2),
      expansion: z.number().int().min(0).max(2),
    }),
    questCycle: z.number().int().min(0).max(1_000_000),
    questClaimed: z
      .array(
        z.enum([
          "welcome",
          "tasting",
          "combo",
          "stove",
          "onigiri",
          "hire",
          "quick",
          "team",
          "terrace",
          "vip",
          "decor",
          "tamago",
          "regulars",
          "tables",
          "revenue",
          "special",
        ]),
      )
      .max(15)
      .refine((ids) => new Set(ids).size === ids.length),
    questBaseline: metricsSchema,
  })
  .refine((progress) => {
    const ids =
      progress.questCycle === 0
        ? [
            "welcome",
            "tasting",
            "combo",
            "stove",
            "onigiri",
            "hire",
            "quick",
            "team",
            "terrace",
            "vip",
            "decor",
            "tamago",
            "regulars",
            "tables",
            "revenue",
          ]
        : [
            "regulars",
            "special",
            progress.questCycle % 2 === 0 ? "team" : "vip",
          ];
    return (
      progress.questClaimed.length < ids.length &&
      progress.questClaimed.every((id) => ids.includes(id))
    );
  }) satisfies z.ZodType<Progression>;

const saveSchema = z.object({
  version: z.literal(2),
  progress: progressSchema,
  carrying: food.nullable(),
  queue: z.array(food).max(3),
});
export type KitchenSave = z.infer<typeof saveSchema>;

export function parseSave(value: unknown): KitchenSave | null {
  const result = saveSchema.safeParse(value);
  return result.success ? result.data : null;
}

export function saveSnapshot(game: GameState): KitchenSave {
  return {
    version: 2,
    progress: progressSchema.parse(game),
    carrying: game.carrying,
    queue: [
      ...game.readyDishes,
      ...game.waiters.flatMap((waiter) =>
        waiter.carrying ? [waiter.carrying] : [],
      ),
    ],
  };
}

export function restoreSave(saved: KitchenSave): GameState {
  const game = startGame(saved.progress);
  game.carrying = saved.carrying;
  game.readyDishes = [...saved.queue];
  game.phase = "ready";
  game.message = "Kedaimu tersimpan. Lanjutkan kapan pun kamu siap.";
  return game;
}
