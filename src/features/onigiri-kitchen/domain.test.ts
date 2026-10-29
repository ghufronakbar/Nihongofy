import { describe, expect, it } from "vitest";
import {
  ENTRANCE,
  FOOD_IDS,
  MENU,
  COUNTER,
  PICKUP,
  TABLES,
  TRASH_BIN,
  createGame,
  buyUpgrade,
  distance,
  findPath,
  goInteract,
  interact,
  interactionPoint,
  isWalkable,
  nearbyInteraction,
  pauseGame,
  project,
  resumeGame,
  startGame,
  tickGame,
  unproject,
  walkTo,
  type FoodId,
  type GameState,
  type Point,
} from "./domain";

function advance(game: GameState, seconds: number) {
  for (let elapsed = 0; elapsed < seconds; elapsed += 0.05)
    tickGame(game, Math.min(0.05, seconds - elapsed));
}

function prepare(game: GameState, food: FoodId) {
  goInteract(game, { kind: "station", food });
  advance(game, 6);
  expect(game.carrying).toBe(food);
}

describe("Onigiri Kitchen navigation", () => {
  it("projects and reverses world coordinates at room corners and service points", () => {
    for (const point of [
      ENTRANCE,
      TRASH_BIN.servicePoint,
      ...TABLES,
      ...FOOD_IDS.map((food) => MENU[food].position),
      { x: 0.5, y: 8.5 },
    ]) {
      const actual = unproject(project(point));
      expect(actual.x).toBeCloseTo(point.x, 8);
      expect(actual.y).toBeCloseTo(point.y, 8);
    }
  });

  it("finds collision-free routes between every station, table, and the entrance", () => {
    const game = startGame();
    for (const expansion of [0, 1, 2]) {
      const points: Point[] = [
        game.player,
        ENTRANCE,
        TRASH_BIN.servicePoint,
        COUNTER.servicePoint,
        PICKUP.servicePoint,
        ...FOOD_IDS.map((food) => ({ x: MENU[food].position.x, y: 2.35 })),
        ...TABLES.slice(0, 3 + expansion).flatMap((table) => [
          { x: table.x + 1.25, y: table.y + 0.35 },
          { x: table.x - 0.55, y: table.y - 1.05 },
        ]),
      ];
      for (const from of points)
        for (const to of points) {
          const path = findPath(from, to, expansion);
          expect(path.length).toBeGreaterThan(0);
          expect(distance(path[path.length - 1], to)).toBeLessThan(0.01);
          let anchor = from;
          for (const step of path) {
            const samples = Math.max(
              1,
              Math.ceil(distance(anchor, step) / 0.05),
            );
            for (let index = 0; index <= samples; index++) {
              expect(
                isWalkable(
                  {
                    x: anchor.x + ((step.x - anchor.x) * index) / samples,
                    y: anchor.y + ((step.y - anchor.y) * index) / samples,
                  },
                  expansion,
                ),
              ).toBe(true);
            }
            anchor = step;
          }
        }
    }
  });

  it("keeps keyboard movement outside furniture and room boundaries", () => {
    const game = startGame();
    game.player = { x: 2.5, y: 6.5 };
    for (let index = 0; index < 300; index++) {
      tickGame(game, 0.02, { x: 0, y: -1 });
      expect(isWalkable(game.player)).toBe(true);
    }
    expect(game.player.y).toBeGreaterThan(TABLES[0].y);
    for (let index = 0; index < 100; index++) {
      tickGame(game, 0.02, { x: 1, y: 0 });
      expect(isWalkable(game.player)).toBe(true);
    }
    expect(game.player.x).toBeLessThanOrEqual(9.65);
  });

  it("rejects invalid destinations and ends a click route at a reachable floor point", () => {
    expect(findPath({ x: 4, y: 3 }, { x: NaN, y: 2 })).toEqual([]);
    const game = startGame();
    walkTo(game, { x: 8, y: 6 });
    advance(game, 4);
    expect(game.player).toEqual({ x: 8, y: 6 });
    expect(game.destination).toBeNull();
  });
});

describe("Onigiri Kitchen service", () => {
  it("waits for Start and creates the first actionable customer immediately", () => {
    const idle = createGame();
    tickGame(idle, 10);
    expect(idle.elapsed).toBe(0);
    const game = startGame();
    expect(game.customers).toHaveLength(1);
    expect(game.customers[0]).toMatchObject({
      food: "onigiri",
      state: "waiting",
      table: 0,
    });
  });

  it("walks, prepares, carries and serves a matching order with tip and vocabulary credit", () => {
    const game = startGame();
    const customer = game.customers[0];
    prepare(game, "onigiri");
    goInteract(game, { kind: "customer", id: customer.id });
    advance(game, 7);
    expect(game.served).toBe(1);
    expect(game.score).toBeGreaterThan(MENU.onigiri.price);
    expect(game.carrying).toBeNull();
    expect(game.learned).toEqual(["onigiri"]);
    expect(game.combo).toBe(1);
    expect(game.feedback?.text ?? game.message).toBeTruthy();
  });

  it("recovers from a wrong dish by walking to the bin and then serving the correct menu", () => {
    const game = startGame();
    prepare(game, "tamago");
    goInteract(game, { kind: "customer", id: game.customers[0].id });
    advance(game, 5);
    expect(game.carrying).toBe("tamago");
    expect(game.served).toBe(0);
    expect(game.score).toBe(0);
    expect(game.message).toContain("ingin Onigiri");
    expect(game.message).toContain("tong sampah");
    goInteract(game, { kind: "trash" });
    expect(game.carrying).toBe("tamago");
    advance(game, 5);
    expect(game.carrying).toBeNull();
    expect(game.score).toBe(0);
    prepare(game, "onigiri");
    goInteract(game, { kind: "customer", id: game.customers[0].id });
    advance(game, 5);
    expect(game.carrying).toBeNull();
    expect(game.served).toBe(1);
    expect(game.score).toBeGreaterThanOrEqual(MENU.onigiri.price);
  });

  it("requires approaching the solid bin and charges once per discarded menu", () => {
    const game = startGame();
    game.score = 100;
    game.combo = 2;
    game.carrying = "ocha";
    expect(isWalkable(TRASH_BIN.position)).toBe(false);
    expect(isWalkable(TRASH_BIN.servicePoint)).toBe(true);
    const before = structuredClone(game);
    interact(game, { kind: "trash" });
    expect(game).toEqual(before);

    goInteract(game, { kind: "trash" });
    advance(game, 1.5);
    expect(game.carrying).toBeNull();
    expect(game.score).toBe(100 - TRASH_BIN.penalty);
    expect(game.combo).toBe(2);
    expect(game.served).toBe(0);
    expect(game.learned).toEqual([]);
    expect(nearbyInteraction(game)).toEqual({ kind: "trash" });
    expect(game.feedback?.tone).toBe("penalty");
    expect(game.feedback?.text).toBe(`−¥${TRASH_BIN.penalty}`);
    const cue = { ...game.cue };
    interact(game, { kind: "trash" });
    expect(game.score).toBe(100 - TRASH_BIN.penalty);
    expect(game.cue).toEqual(cue);
    expect(game.message).toContain("sudah kosong");
  });

  it.each([0, 10, 20])(
    "keeps a score of ¥%i from becoming negative when discarding",
    (score) => {
      const game = startGame();
      game.player = { ...TRASH_BIN.servicePoint };
      game.carrying = "tamago";
      game.score = score;
      interact(game, { kind: "trash" });
      expect(game.carrying).toBeNull();
      expect(game.score).toBe(Math.max(0, score - TRASH_BIN.penalty));
    },
  );

  it.each(["ready", "paused"] as const)(
    "cannot discard during the %s phase",
    (phase) => {
      const game = startGame();
      game.phase = phase;
      game.player = { ...TRASH_BIN.servicePoint };
      game.carrying = "onigiri";
      game.score = 100;
      const before = structuredClone(game);
      goInteract(game, { kind: "trash" });
      interact(game, { kind: "trash" });
      expect(game).toEqual(before);
    },
  );

  it("does not overwrite a carried dish and cancels preparation when walking away", () => {
    const game = startGame();
    prepare(game, "ocha");
    goInteract(game, { kind: "station", food: "tamago" });
    advance(game, 4);
    expect(game.carrying).toBe("ocha");
    expect(game.preparing).toBeNull();
    goInteract(game, { kind: "trash" });
    advance(game, 4);
    goInteract(game, { kind: "station", food: "onigiri" });
    advance(game, 2);
    expect(game.preparing?.food).toBe("onigiri");
    walkTo(game, { x: 4, y: 3.5 });
    expect(game.preparing).toBeNull();
  });

  it("freezes all shift state during pause and resumes a pending route", () => {
    const game = startGame();
    goInteract(game, { kind: "station", food: "onigiri" });
    advance(game, 0.1);
    pauseGame(game);
    const saved = structuredClone(game);
    tickGame(game, 100);
    expect(game).toEqual(saved);
    resumeGame(game);
    advance(game, 5);
    expect(game.carrying).toBe("onigiri");
  });

  it("expires waiting orders once, resets combo, and lets customers leave", () => {
    const game = startGame();
    game.combo = 3;
    const customer = game.customers[0];
    customer.patience = 0.01;
    tickGame(game, 0.1);
    expect(game.missed).toBe(1);
    expect(game.combo).toBe(0);
    expect(customer.state).toBe("leaving");
    expect(
      interactionPoint(game, { kind: "customer", id: customer.id }),
    ).toBeNull();
    advance(game, 7);
    expect(game.missed).toBe(1);
    expect(
      game.customers.find((entry) => entry.id === customer.id),
    ).toBeUndefined();
  });

  it("keeps the cafe playable beyond three minutes with new customers and income", () => {
    const game = startGame();
    for (let minute = 0; minute < 6; minute++) tickGame(game, 60);
    expect(game.elapsed).toBeCloseTo(360, 5);
    expect(game.phase).toBe("playing");
    const customer = game.customers.find((entry) => entry.state === "waiting");
    expect(customer).toBeDefined();
    if (!customer) throw new Error("Expected a waiting customer");
    const food = customer.food;
    prepare(game, food);
    goInteract(game, { kind: "customer", id: customer.id });
    advance(game, 6);
    expect(game.revenue).toBeGreaterThan(0);
    expect(game.phase).toBe("playing");
    expect(game.nextId).toBeGreaterThan(10);
  });
});

describe("Onigiri Kitchen growth and staff", () => {
  it("gives both waiters separate resting positions away from the chef's handoff point", () => {
    const game = startGame();
    game.score = 1000;
    buyUpgrade(game, "waiter");
    buyUpgrade(game, "waiter");
    advance(game, 1);
    expect(game.waiters).toHaveLength(2);
    expect(
      distance(game.waiters[0].position, game.waiters[1].position),
    ).toBeGreaterThan(0.7);
    for (const waiter of game.waiters) {
      expect(waiter.position).toEqual(waiter.home);
      expect(isWalkable(waiter.home)).toBe(true);
      expect(distance(waiter.home, PICKUP.servicePoint)).toBeGreaterThan(0.8);
    }
  });

  it("pauses the whole simulation as soon as the chef reaches management", () => {
    const game = startGame();
    goInteract(game, { kind: "manage" });
    tickGame(game, 30);
    expect(game.phase).toBe("paused");
    expect(game.panel).toBe("upgrades");
    expect(game.elapsed).toBeLessThan(2);
    const paused = structuredClone(game);
    tickGame(game, 60);
    expect(game).toEqual(paused);
    resumeGame(game);
    expect(game.panel).toBeNull();
    advance(game, 1);
    expect(game.elapsed).toBeGreaterThan(paused.elapsed);
  });

  it("applies cooking speed, walking speed and patience upgrades", () => {
    const regular = startGame();
    const upgraded = startGame();
    upgraded.score = 2000;
    expect(buyUpgrade(upgraded, "stove")).toBe(true);
    expect(buyUpgrade(upgraded, "shoes")).toBe(true);
    expect(buyUpgrade(upgraded, "decor")).toBe(true);
    expect(upgraded.customers[0].patience).toBe(
      regular.customers[0].patience + 15,
    );
    expect(upgraded.customers[0].maxPatience).toBe(
      regular.customers[0].maxPatience + 15,
    );
    for (const game of [regular, upgraded]) {
      game.player = { x: MENU.onigiri.position.x, y: 2.35 };
      interact(game, { kind: "station", food: "onigiri" });
    }
    expect(upgraded.preparing?.duration).toBeCloseTo(
      MENU.onigiri.preparation * 0.75,
    );
    tickGame(regular, 1);
    tickGame(upgraded, 1);
    expect(regular.carrying).toBeNull();
    expect(upgraded.carrying).toBe("onigiri");
    for (const game of [regular, upgraded]) {
      game.player = { x: 4.2, y: 3 };
      tickGame(game, 0.25, { x: 1, y: 0 });
    }
    expect(upgraded.player.x - 4.2).toBeCloseTo((regular.player.x - 4.2) * 1.2);
  });

  it("opens real terrace tables and safely replans paths when another table is added", () => {
    const game = startGame();
    game.score = 1500;
    expect(isWalkable(TABLES[3])).toBe(false);
    expect(buyUpgrade(game, "expansion")).toBe(true);
    expect(game.customers.some((customer) => customer.table === 3)).toBe(true);
    expect(isWalkable(TABLES[4], 1)).toBe(true);
    game.player = { ...TABLES[4] };
    walkTo(game, { x: 13, y: 8 });
    expect(buyUpgrade(game, "expansion")).toBe(true);
    expect(isWalkable(game.player, 2)).toBe(true);
    expect(isWalkable(TABLES[4], 2)).toBe(false);
    expect(game.customers.some((customer) => customer.table === 4)).toBe(true);
    for (let index = 0; index < 100; index++) {
      tickGame(game, 0.05);
      expect(isWalkable(game.player, 2)).toBe(true);
      for (const customer of game.customers)
        expect(isWalkable(customer.position, 2)).toBe(true);
    }
    expect(game.player).toEqual({ x: 13, y: 8 });
    expect(game.score).toBe(200);
    expect(game.revenue).toBe(0);
  });

  it.each([4, 5])(
    "customer %i requires both dishes and only completes the order once",
    (id) => {
      const game = startGame();
      game.nextId = id;
      game.nextCustomer = 0;
      tickGame(game, 0.05);
      advance(game, 8);
      const customer = game.customers.find((entry) => entry.id === id);
      if (!customer) throw new Error("Expected a mixed order");
      expect(customer.state).toBe("waiting");
      expect(customer.order).toHaveLength(2);
      expect(customer.vip).toBe(id === 5);
      for (const [index, food] of customer.order.entries()) {
        const point = interactionPoint(game, { kind: "customer", id });
        if (!point) throw new Error("Expected a service point");
        game.player = point;
        game.carrying = food;
        const before = game.score;
        interact(game, { kind: "customer", id });
        expect(game.score - before).toBeGreaterThanOrEqual(
          MENU[food].price * (id === 5 ? 1.5 : 1),
        );
        expect(game.served).toBe(index);
        expect(game.combo).toBe(index);
      }
      expect(customer.state).toBe("leaving");
      expect(game.vipServed).toBe(id === 5 ? 1 : 0);
      expect(game.score).toBe(game.revenue);
    },
  );

  it("hires a waiter who physically collects and delivers the matching prepared dish", () => {
    const game = startGame();
    game.score = 350;
    expect(buyUpgrade(game, "waiter")).toBe(true);
    expect(game.waiters).toHaveLength(1);
    expect(game.score).toBe(0);
    prepare(game, "onigiri");
    goInteract(game, { kind: "handoff" });
    advance(game, 2);
    expect(game.carrying).toBeNull();
    expect(game.served).toBe(0);
    expect(game.waiters[0].carrying).toBe("onigiri");
    expect(game.waiters[0].moving).toBe(true);
    advance(game, 4);
    expect(game.waiterServed).toBe(1);
    expect(game.served).toBe(1);
    expect(game.dishTotals.onigiri).toBe(1);
    expect(game.waiters[0].carrying).toBeNull();
    expect(game.readyDishes).toEqual([]);
    expect(
      distance(game.waiters[0].position, game.waiters[0].home),
    ).toBeLessThan(0.01);
  });

  it("returns reserved food if the chef serves the customer while a waiter is walking", () => {
    const game = startGame();
    game.score = 350;
    buyUpgrade(game, "waiter");
    game.nextCustomer = Infinity;
    game.readyDishes = ["onigiri"];
    tickGame(game, 0.1);
    const waiter = game.waiters[0];
    expect(waiter.carrying).toBe("onigiri");
    game.player = interactionPoint(game, { kind: "customer", id: 1 })!;
    game.carrying = "onigiri";
    interact(game, { kind: "customer", id: 1 });
    tickGame(game, 0.05);
    expect(game.served).toBe(1);
    expect(game.waiterServed).toBe(0);
    expect(waiter.carrying).toBeNull();
    expect(game.readyDishes).toEqual(["onigiri"]);
    advance(game, 6);
    expect(game.served).toBe(1);
    expect(game.readyDishes).toEqual(["onigiri"]);
  });

  it("keeps unmatched food queued and prevents overflow or handoff without a waiter", () => {
    const game = startGame();
    game.player = { ...PICKUP.servicePoint };
    game.carrying = "tamago";
    interact(game, { kind: "handoff" });
    expect(game.carrying).toBe("tamago");
    expect(game.readyDishes).toEqual([]);
    game.score = 350;
    buyUpgrade(game, "waiter");
    interact(game, { kind: "handoff" });
    tickGame(game, 0.1);
    expect(game.readyDishes).toEqual(["tamago"]);
    expect(game.waiters[0].carrying).toBeNull();
    game.readyDishes = ["tamago", "tamago", "ocha"];
    game.carrying = "onigiri";
    interact(game, { kind: "handoff" });
    expect(game.readyDishes).toHaveLength(3);
    expect(game.carrying).toBe("onigiri");
  });
});
