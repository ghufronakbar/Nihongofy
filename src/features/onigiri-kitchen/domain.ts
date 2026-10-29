import {
  createProgression,
  claimQuest,
  purchaseUpgrade,
  type Progression,
  type UpgradeId,
} from "./progression";

export type Point = { x: number; y: number };
export type FoodId = "onigiri" | "tamago" | "ocha";
export type Phase = "ready" | "playing" | "paused";

export const KITCHEN_STORAGE_KEY = "nihongofy:onigiri-kitchen:v1";
export const ASSET_PATH = "/mini-games/onigiri-kitchen";

export const MENU = {
  onigiri: {
    name: "Onigiri",
    japanese: "おにぎり",
    meaning: "Nasi kepal",
    price: 100,
    preparation: 1.2,
    position: { x: 2, y: 1.05 },
  },
  tamago: {
    name: "Tamago",
    japanese: "たまご",
    meaning: "Telur",
    price: 120,
    preparation: 1.6,
    position: { x: 4.65, y: 1.05 },
  },
  ocha: {
    name: "Ocha",
    japanese: "おちゃ",
    meaning: "Teh",
    price: 80,
    preparation: 0.8,
    position: { x: 7.3, y: 1.05 },
  },
} as const satisfies Record<
  FoodId,
  {
    name: string;
    japanese: string;
    meaning: string;
    price: number;
    preparation: number;
    position: Point;
  }
>;

export const FOOD_IDS: FoodId[] = ["onigiri", "tamago", "ocha"];
export const TABLES = [
  { x: 2.5, y: 4.6 },
  { x: 6.65, y: 4.4 },
  { x: 5.9, y: 7.1 },
  { x: 11.7, y: 4 },
  { x: 11.7, y: 7.1 },
] as const;
export const COUNTER = {
  position: { x: 1, y: 2.75 },
  servicePoint: { x: 2.1, y: 2.75 },
};
export const PICKUP = {
  position: { x: 4.55, y: 8.35 },
  servicePoint: { x: 4.5, y: 7.45 },
  capacity: 3,
};
export const tableCount = (expansion: number) => 3 + expansion;
export const ENTRANCE: Point = { x: 9.15, y: 8.15 };
export const TRASH_BIN = {
  position: { x: 9.3, y: 2.4 },
  servicePoint: { x: 8.3, y: 2.65 },
  penalty: 20,
} as const;
export const PLANTS: Point[] = [
  { x: 0.65, y: 4.2 },
  { x: 9.3, y: 5.9 },
  { x: 0.8, y: 7.8 },
];

export type Interaction =
  | { kind: "station"; food: FoodId }
  | { kind: "customer"; id: number }
  | { kind: "trash" }
  | { kind: "manage" }
  | { kind: "handoff" };
export type Customer = {
  id: number;
  table: number;
  food: FoodId;
  appearance: number;
  position: Point;
  path: Point[];
  state: "entering" | "waiting" | "leaving";
  patience: number;
  maxPatience: number;
  order: FoodId[];
  remaining: FoodId[];
  vip: boolean;
  waited: number;
};
export type Waiter = {
  id: number;
  home: Point;
  position: Point;
  path: Point[];
  carrying: FoodId | null;
  target: number | null;
  moving: boolean;
};
export type GameState = Progression & {
  phase: Phase;
  elapsed: number;
  combo: number;
  player: Point;
  facing: "front" | "back" | "left" | "right";
  moving: boolean;
  carrying: FoodId | null;
  preparing: { food: FoodId; remaining: number; duration: number } | null;
  path: Point[];
  interaction: Interaction | null;
  destination: Point | null;
  customers: Customer[];
  nextCustomer: number;
  nextId: number;
  readyDishes: FoodId[];
  waiters: Waiter[];
  panel: "upgrades" | null;
  message: string;
  messageUntil: number;
  cue: {
    id: number;
    type:
      "serve" | "ready" | "arrive" | "miss" | "discard" | "upgrade" | "quest";
  };
  feedback: {
    text: string;
    position: Point;
    until: number;
    tone: "reward" | "penalty";
  } | null;
};

export const distance = (a: Point, b: Point) =>
  Math.hypot(a.x - b.x, a.y - b.y);

export function project(point: Point): Point {
  return {
    x: 470 + (point.x - point.y) * 48,
    y: 180 + (point.x + point.y) * 25,
  };
}

export function unproject(point: Point): Point {
  const dx = (point.x - 470) / 48;
  const dy = (point.y - 180) / 25;
  return { x: (dx + dy) / 2, y: (dy - dx) / 2 };
}

export function isWalkable(point: Point, expansion = 0): boolean {
  if (
    !Number.isFinite(point.x) ||
    !Number.isFinite(point.y) ||
    point.x < 0.35 ||
    point.x > (expansion > 0 ? 13.65 : 9.65) ||
    point.y < 0.45 ||
    point.y > 8.65
  )
    return false;
  if (point.y < 1.95 && point.x > 0.75 && point.x < 8.6) return false;
  if (
    TABLES.slice(0, tableCount(expansion)).some(
      (table) => distance(table, point) < 0.99,
    )
  )
    return false;
  if (PLANTS.some((plant) => distance(plant, point) < 0.5)) return false;
  if (distance(TRASH_BIN.position, point) < 0.55) return false;
  if (distance(PICKUP.position, point) < 0.55) return false;
  // The small welcome counter is a real obstacle, just like the kitchen units.
  return !(point.x < 1.7 && point.y > 2.1 && point.y < 3.4);
}

const GRID = 0.25;
const GRID_WIDTH = 57;
const GRID_HEIGHT = 37;
const nodeKey = (x: number, y: number) => y * GRID_WIDTH + x;
const nodePoint = (key: number): Point => ({
  x: (key % GRID_WIDTH) * GRID,
  y: Math.floor(key / GRID_WIDTH) * GRID,
});

function nearestNode(point: Point, expansion: number): number | null {
  let nearest: number | null = null;
  let bestDistance = Infinity;
  for (let y = 2; y < GRID_HEIGHT - 2; y++) {
    for (let x = 2; x < GRID_WIDTH - 2; x++) {
      const candidate = { x: x * GRID, y: y * GRID };
      const delta = distance(candidate, point);
      if (delta < bestDistance && isWalkable(candidate, expansion)) {
        nearest = nodeKey(x, y);
        bestDistance = delta;
      }
    }
  }
  return nearest;
}

function clearSegment(a: Point, b: Point, expansion: number): boolean {
  // A sampled line can miss a circle at a tangent. Check furniture analytically too.
  const dx = b.x - a.x;
  const dy = b.y - a.y;
  const lengthSquared = dx * dx + dy * dy;
  const circles = [
    ...TABLES.slice(0, tableCount(expansion)).map((point) => ({
      point,
      radius: 0.99,
    })),
    ...PLANTS.map((point) => ({ point, radius: 0.5 })),
    { point: TRASH_BIN.position, radius: 0.55 },
    { point: PICKUP.position, radius: 0.55 },
  ];
  for (const { point, radius } of circles) {
    const t = lengthSquared
      ? Math.max(
          0,
          Math.min(
            1,
            ((point.x - a.x) * dx + (point.y - a.y) * dy) / lengthSquared,
          ),
        )
      : 0;
    if (distance(point, { x: a.x + t * dx, y: a.y + t * dy }) < radius)
      return false;
  }
  const steps = Math.max(1, Math.ceil(distance(a, b) / 0.08));
  for (let i = 0; i <= steps; i++) {
    if (
      !isWalkable(
        {
          x: a.x + ((b.x - a.x) * i) / steps,
          y: a.y + ((b.y - a.y) * i) / steps,
        },
        expansion,
      )
    )
      return false;
  }
  return true;
}

/** A small navigation grid with line-of-sight smoothing; never cuts through furniture. */
export function findPath(from: Point, to: Point, expansion = 0): Point[] {
  if (!Number.isFinite(to.x) || !Number.isFinite(to.y)) return [];
  if (isWalkable(to, expansion) && clearSegment(from, to, expansion))
    return [{ ...to }];
  const start = nearestNode(from, expansion);
  const end = nearestNode(to, expansion);
  if (start === null || end === null) return [];
  const queue = [start];
  const previous = new Map<number, number | null>([[start, null]]);
  for (let head = 0; head < queue.length && !previous.has(end); head++) {
    const current = queue[head];
    const x = current % GRID_WIDTH;
    const y = Math.floor(current / GRID_WIDTH);
    for (const [dx, dy] of [
      [0, -1],
      [1, 0],
      [0, 1],
      [-1, 0],
    ]) {
      const nx = x + dx;
      const ny = y + dy;
      const next = nodeKey(nx, ny);
      if (
        nx < 0 ||
        nx >= GRID_WIDTH ||
        ny < 0 ||
        ny >= GRID_HEIGHT ||
        previous.has(next) ||
        !isWalkable(nodePoint(next), expansion)
      )
        continue;
      previous.set(next, current);
      queue.push(next);
    }
  }
  if (!previous.has(end)) return [];
  const raw: Point[] = [];
  let current: number | null = end;
  while (current !== null) {
    raw.unshift(nodePoint(current));
    current = previous.get(current) ?? null;
  }
  if (
    isWalkable(to, expansion) &&
    clearSegment(raw[raw.length - 1], to, expansion)
  )
    raw.push({ ...to });
  const result: Point[] = [];
  let anchor = from;
  for (let i = 0; i < raw.length;) {
    let farthest = i;
    for (let j = i; j < raw.length; j++) {
      if (clearSegment(anchor, raw[j], expansion)) farthest = j;
    }
    result.push(raw[farthest]);
    anchor = raw[farthest];
    i = farthest + 1;
  }
  return result;
}

export function createGame(
  progress: Progression = createProgression(),
): GameState {
  return {
    ...structuredClone(progress),
    phase: "ready",
    elapsed: 0,
    combo: 0,
    player: { x: 4.6, y: 3.15 },
    facing: "front",
    moving: false,
    carrying: null,
    preparing: null,
    path: [],
    interaction: null,
    destination: null,
    customers: [],
    nextCustomer: 9,
    nextId: 1,
    readyDishes: [],
    waiters: Array.from({ length: progress.upgrades.waiter }, (_, id) =>
      createWaiter(id),
    ),
    panel: null,
    message: "Kedai kecilmu siap dibuka.",
    messageUntil: 0,
    cue: { id: 0, type: "arrive" },
    feedback: null,
  };
}

function notify(game: GameState, message: string) {
  game.message = message;
  game.messageUntil = game.elapsed + 4;
}

function sound(game: GameState, type: GameState["cue"]["type"]) {
  game.cue = { id: game.cue.id + 1, type };
}

function seatPosition(table: number): Point {
  return { x: TABLES[table].x - 0.55, y: TABLES[table].y - 1.05 };
}

function spawnCustomer(game: GameState, instant = false, preferred?: number) {
  const available = (index: number) =>
    !game.customers.some(
      (customer) => customer.table === index && customer.state !== "leaving",
    );
  const table =
    preferred !== undefined &&
    preferred < tableCount(game.upgrades.expansion) &&
    available(preferred)
      ? preferred
      : TABLES.slice(0, tableCount(game.upgrades.expansion)).findIndex(
          (_, index) =>
            !game.customers.some(
              (customer) =>
                customer.table === index && customer.state !== "leaving",
            ),
        );
  if (table < 0) return;
  const id = game.nextId++;
  const vip = id % 5 === 0;
  const food = FOOD_IDS[(id - 1) % FOOD_IDS.length];
  const order =
    id % 4 === 0 || vip ? [food, FOOD_IDS[id % FOOD_IDS.length]] : [food];
  const patience = 65 + game.upgrades.decor * 15 + (order.length > 1 ? 20 : 0);
  game.customers.push({
    id,
    table,
    food,
    appearance: (id - 1) % 4,
    position: instant ? seatPosition(table) : { ...ENTRANCE },
    path: instant
      ? []
      : findPath(ENTRANCE, seatPosition(table), game.upgrades.expansion),
    state: instant ? "waiting" : "entering",
    patience,
    maxPatience: patience,
    order,
    remaining: [...order],
    vip,
    waited: 0,
  });
  sound(game, "arrive");
}

export function startGame(
  progress: Progression = createProgression(),
): GameState {
  const game = createGame(progress);
  game.phase = "playing";
  spawnCustomer(game, true);
  notify(
    game,
    "Pelanggan pertama ingin onigiri. Ketuk menu おにぎり di dapur!",
  );
  return game;
}

export function pauseGame(game: GameState) {
  if (game.phase !== "playing") return;
  game.phase = "paused";
  game.moving = false;
}

export function resumeGame(game: GameState) {
  if (game.phase === "paused") {
    game.panel = null;
    game.phase = "playing";
  }
}

export function walkTo(game: GameState, target: Point) {
  if (game.phase !== "playing") return;
  game.preparing = null;
  game.interaction = null;
  game.path = findPath(game.player, target, game.upgrades.expansion);
  game.destination = game.path.length
    ? { ...game.path[game.path.length - 1] }
    : null;
}

export function interactionPoint(
  game: GameState,
  interaction: Interaction,
): Point | null {
  if (interaction.kind === "station")
    return { x: MENU[interaction.food].position.x, y: 2.35 };
  if (interaction.kind === "trash") return { ...TRASH_BIN.servicePoint };
  if (interaction.kind === "manage") return { ...COUNTER.servicePoint };
  if (interaction.kind === "handoff") return { ...PICKUP.servicePoint };
  const customer = game.customers.find(
    (entry) => entry.id === interaction.id && entry.state === "waiting",
  );
  if (!customer) return null;
  return {
    x: TABLES[customer.table].x + 1.25,
    y: TABLES[customer.table].y + 0.35,
  };
}

export function goInteract(game: GameState, interaction: Interaction) {
  if (game.phase !== "playing") return;
  const target = interactionPoint(game, interaction);
  if (!target) return;
  walkTo(game, target);
  game.interaction = interaction;
}

function customerLeaves(game: GameState, customer: Customer) {
  customer.state = "leaving";
  customer.path = findPath(
    customer.position,
    ENTRANCE,
    game.upgrades.expansion,
  );
}

export function interact(game: GameState, interaction: Interaction) {
  if (game.phase !== "playing" || game.preparing) return;
  const target = interactionPoint(game, interaction);
  if (!target || distance(game.player, target) > 1.15) return;
  if (interaction.kind === "manage") {
    game.panel = "upgrades";
    pauseGame(game);
    return;
  }
  if (interaction.kind === "handoff") {
    if (!game.upgrades.waiter) {
      notify(
        game,
        "Rekrut Aya lewat Kelola kedai. Ia akan mengantar menu dari meja ini.",
      );
      return;
    }
    if (!game.carrying) {
      notify(
        game,
        "Masak menu dulu, lalu taruh di meja pengambilan untuk pelayan.",
      );
      return;
    }
    if (
      game.readyDishes.length +
        game.waiters.filter((waiter) => waiter.carrying).length >=
      PICKUP.capacity
    ) {
      notify(game, "Meja pengambilan penuh. Tunggu pelayan mengantar pesanan.");
      return;
    }
    const food = game.carrying;
    game.readyDishes.push(food);
    game.carrying = null;
    notify(
      game,
      `${MENU[food].name} siap diantar pelayan. Kamu bisa lanjut memasak.`,
    );
    sound(game, "ready");
    return;
  }
  if (interaction.kind === "trash") {
    if (!game.carrying) {
      notify(game, "Nampanmu sudah kosong. Tidak ada menu yang perlu dibuang.");
      return;
    }
    const food = game.carrying;
    const deduction = Math.min(game.score, TRASH_BIN.penalty);
    game.score -= deduction;
    game.carrying = null;
    game.feedback = {
      text: deduction > 0 ? `−¥${deduction}` : "Dibuang",
      position: { ...TRASH_BIN.position },
      until: game.elapsed + 1.8,
      tone: "penalty",
    };
    notify(
      game,
      `${MENU[food].name} dibuang. ${deduction > 0 ? `Uang kedai −¥${deduction}.` : "Uang kedai tetap ¥0."} Nampan siap mengambil menu lain.`,
    );
    sound(game, "discard");
    return;
  }
  if (interaction.kind === "station") {
    if (game.carrying) {
      notify(
        game,
        `Tanganmu membawa ${MENU[game.carrying].name}. Antar dulu, atau ketuk tong sampah di kanan dapur untuk membuangnya (−¥${TRASH_BIN.penalty}).`,
      );
      return;
    }
    const food = MENU[interaction.food];
    game.facing = "back";
    game.preparing = {
      food: interaction.food,
      duration: food.preparation * [1, 0.75, 0.6, 0.45][game.upgrades.stove],
      remaining: food.preparation * [1, 0.75, 0.6, 0.45][game.upgrades.stove],
    };
    notify(game, `Menyiapkan ${food.name}…`);
    return;
  }
  const customer = game.customers.find(
    (entry) => entry.id === interaction.id && entry.state === "waiting",
  );
  if (!customer) return;
  if (!game.carrying) {
    notify(
      game,
      `Meja ${customer.table + 1} ingin ${MENU[customer.food].name}. Ambil di dapur dulu.`,
    );
    return;
  }
  if (!customer.remaining.includes(game.carrying)) {
    notify(
      game,
      `Pelanggan ini ingin ${MENU[customer.food].name}. ${MENU[game.carrying].name} tetap di nampanmu. Salah ambil? Ketuk tong sampah di kanan dapur (−¥${TRASH_BIN.penalty}).`,
    );
    return;
  }
  const food = game.carrying;
  game.carrying = null;
  serveDish(game, customer, food, false);
}

function serveDish(
  game: GameState,
  customer: Customer,
  food: FoodId,
  byWaiter: boolean,
) {
  const index = customer.remaining.indexOf(food);
  if (customer.state !== "waiting" || index < 0) return;
  customer.remaining.splice(index, 1);
  const complete = customer.remaining.length === 0;
  if (complete) {
    game.combo++;
    game.bestCombo = Math.max(game.bestCombo, game.combo);
    game.served++;
    if (customer.waited <= 15) game.quickServed++;
    if (customer.vip) game.vipServed++;
    if (byWaiter) game.waiterServed++;
  }
  const tip =
    Math.round((customer.patience / customer.maxPatience) * 30) +
    Math.min(Math.max(0, game.combo - 1), 5) * 10 +
    game.upgrades.decor * 5;
  const earnings =
    Math.round(MENU[food].price * (customer.vip ? 1.5 : 1)) +
    Math.round(tip / customer.order.length);
  game.score += earnings;
  game.revenue += earnings;
  game.dishTotals[food]++;
  if (!game.learned.includes(food)) game.learned.push(food);
  game.feedback = {
    text: `+¥${earnings}`,
    position: { ...customer.position },
    until: game.elapsed + 1.8,
    tone: "reward",
  };
  if (complete) customerLeaves(game, customer);
  else customer.food = customer.remaining[0];
  notify(
    game,
    complete
      ? `${byWaiter ? "Pelayan mengantar. " : "Arigatou! "}${game.combo > 1 ? `Combo ${game.combo} — ` : ""}Pesanan lengkap, pelanggan senang.`
      : `Satu menu diantar. Meja ${customer.table + 1} masih ingin ${customer.remaining.map((item) => MENU[item].name).join(" dan ")}.`,
  );
  sound(game, "serve");
}

export function nearbyInteraction(game: GameState): Interaction | null {
  const candidates: Interaction[] = [
    ...game.customers
      .filter((customer) => customer.state === "waiting")
      .map((customer): Interaction => ({ kind: "customer", id: customer.id })),
    ...FOOD_IDS.map((food): Interaction => ({ kind: "station", food })),
    { kind: "trash" },
    { kind: "manage" },
    { kind: "handoff" },
  ];
  let closest: Interaction | null = null;
  let nearest = 1.15;
  for (const candidate of candidates) {
    const point = interactionPoint(game, candidate);
    if (point && distance(game.player, point) < nearest) {
      closest = candidate;
      nearest = distance(game.player, point);
    }
  }
  return closest;
}

function createWaiter(id: number): Waiter {
  const home = {
    x: PICKUP.servicePoint.x - 0.9 - id * 0.75,
    y: PICKUP.servicePoint.y + 0.15,
  };
  return {
    id,
    home,
    position: { ...home },
    path: [],
    carrying: null,
    target: null,
    moving: false,
  };
}

function tickWaiters(game: GameState, dt: number) {
  for (const waiter of game.waiters) {
    if (waiter.target !== null) {
      const customer = game.customers.find(
        (entry) => entry.id === waiter.target && entry.state === "waiting",
      );
      if (
        !customer ||
        !waiter.carrying ||
        !customer.remaining.includes(waiter.carrying)
      ) {
        if (waiter.carrying) game.readyDishes.push(waiter.carrying);
        waiter.carrying = null;
        waiter.target = null;
        waiter.path = findPath(
          waiter.position,
          waiter.home,
          game.upgrades.expansion,
        );
      }
    }
    waiter.moving = advancePath(waiter.position, waiter.path, 3.2 * dt);
    if (waiter.path.length) continue;
    if (waiter.target !== null && waiter.carrying) {
      const customer = game.customers.find(
        (entry) => entry.id === waiter.target && entry.state === "waiting",
      );
      if (customer) serveDish(game, customer, waiter.carrying, true);
      waiter.carrying = null;
      waiter.target = null;
      waiter.path = findPath(
        waiter.position,
        waiter.home,
        game.upgrades.expansion,
      );
      continue;
    }
    if (distance(waiter.position, waiter.home) > 0.1) {
      waiter.path = findPath(
        waiter.position,
        waiter.home,
        game.upgrades.expansion,
      );
      continue;
    }
    const customer = game.customers
      .filter(
        (entry) =>
          entry.state === "waiting" &&
          !game.waiters.some((other) => other.target === entry.id) &&
          game.readyDishes.some((food) => entry.remaining.includes(food)),
      )
      .sort((a, b) => a.patience - b.patience)[0];
    if (!customer) continue;
    const foodIndex = game.readyDishes.findIndex((food) =>
      customer.remaining.includes(food),
    );
    waiter.carrying = game.readyDishes.splice(foodIndex, 1)[0];
    waiter.target = customer.id;
    const target = interactionPoint(game, {
      kind: "customer",
      id: customer.id,
    });
    if (target)
      waiter.path = findPath(waiter.position, target, game.upgrades.expansion);
  }
}

export function buyUpgrade(game: GameState, id: UpgradeId): boolean {
  if (
    game.phase !== "playing" &&
    !(game.phase === "paused" && game.panel === "upgrades")
  )
    return false;
  if (!purchaseUpgrade(game, id)) return false;
  if (id === "waiter") game.waiters.push(createWaiter(game.waiters.length));
  if (id === "expansion") {
    refreshNavigation(game);
    spawnCustomer(game, false, tableCount(game.upgrades.expansion) - 1);
  }
  if (id === "decor") {
    for (const customer of game.customers) {
      if (customer.state === "leaving") continue;
      customer.patience += 15;
      customer.maxPatience += 15;
    }
  }
  notify(
    game,
    id === "waiter"
      ? "Pelayan bergabung. Taruh masakan di meja pengambilan agar diantar."
      : id === "expansion"
        ? "Teras dibuka. Meja baru siap menyambut pelanggan."
        : "Upgrade terpasang. Kedai kecilmu naik kelas.",
  );
  sound(game, "upgrade");
  return true;
}

/** A new table can occupy an actor's previous route or standing position. */
function refreshNavigation(game: GameState) {
  const expansion = game.upgrades.expansion;
  const relocate = (position: Point) => {
    if (isWalkable(position, expansion)) return;
    const nearest = nearestNode(position, expansion);
    if (nearest !== null) Object.assign(position, nodePoint(nearest));
  };
  relocate(game.player);
  const destination = game.interaction
    ? interactionPoint(game, game.interaction)
    : game.destination;
  game.path = destination ? findPath(game.player, destination, expansion) : [];
  game.destination = game.path.at(-1) ?? null;
  for (const customer of game.customers) {
    relocate(customer.position);
    if (customer.state === "waiting") continue;
    customer.path = findPath(
      customer.position,
      customer.state === "entering" ? seatPosition(customer.table) : ENTRANCE,
      expansion,
    );
  }
  for (const waiter of game.waiters) {
    relocate(waiter.position);
    const target =
      waiter.target === null
        ? waiter.home
        : interactionPoint(game, { kind: "customer", id: waiter.target });
    waiter.path = findPath(waiter.position, target ?? waiter.home, expansion);
  }
}

export function rewardQuest(game: GameState, id: string): boolean {
  if (game.phase === "ready") return false;
  const quest = claimQuest(game, id);
  if (!quest) return false;
  game.feedback = {
    text: `Quest +¥${quest.reward}`,
    position: { ...game.player },
    until: game.elapsed + 1.8,
    tone: "reward",
  };
  notify(
    game,
    `${quest.title} selesai. Hadiah ¥${quest.reward} masuk ke uang kedai.`,
  );
  sound(game, "quest");
  return true;
}

function advancePath(position: Point, path: Point[], amount: number): boolean {
  let remaining = amount;
  let moved = false;
  while (path.length && remaining > 0) {
    const target = path[0];
    const length = distance(position, target);
    if (length <= remaining) {
      position.x = target.x;
      position.y = target.y;
      remaining -= length;
      path.shift();
      moved = true;
    } else {
      position.x += ((target.x - position.x) / length) * remaining;
      position.y += ((target.y - position.y) / length) * remaining;
      remaining = 0;
      moved = true;
    }
  }
  return moved;
}

/** Mutable simulation kept outside React; the UI receives a periodic cloned snapshot. */
export function tickGame(
  game: GameState,
  seconds: number,
  movement: Point = { x: 0, y: 0 },
) {
  if (game.phase !== "playing" || !Number.isFinite(seconds) || seconds <= 0)
    return;
  // Substeps keep collisions, arrivals, and food preparation independent of frame rate.
  let remaining = Math.min(seconds, 60);
  while (remaining > 0.00001 && game.phase === "playing") {
    const dt = Math.min(remaining, 0.05);
    remaining -= dt;
    tickStep(game, dt, movement);
  }
}

function tickStep(game: GameState, dt: number, movement: Point) {
  game.elapsed += dt;
  const before = { ...game.player };
  const magnitude = Math.hypot(movement.x, movement.y);
  if (magnitude > 0) {
    game.path = [];
    game.destination = null;
    game.interaction = null;
    game.preparing = null;
    const speed = 3.6 * (1 + game.upgrades.shoes * 0.2);
    const dx = (movement.x / magnitude) * speed * dt;
    const dy = (movement.y / magnitude) * speed * dt;
    if (
      isWalkable(
        { x: game.player.x + dx, y: game.player.y },
        game.upgrades.expansion,
      )
    )
      game.player.x += dx;
    if (
      isWalkable(
        { x: game.player.x, y: game.player.y + dy },
        game.upgrades.expansion,
      )
    )
      game.player.y += dy;
  } else if (!game.preparing) {
    advancePath(
      game.player,
      game.path,
      3.6 * (1 + game.upgrades.shoes * 0.2) * dt,
    );
  }
  game.moving = distance(before, game.player) > 0.001;
  if (game.moving) {
    const screenBefore = project(before);
    const screenAfter = project(game.player);
    const dx = screenAfter.x - screenBefore.x;
    const dy = screenAfter.y - screenBefore.y;
    game.facing =
      Math.abs(dx) > Math.abs(dy) * 1.5
        ? dx > 0
          ? "right"
          : "left"
        : dy > 0
          ? "front"
          : "back";
  }
  if (!game.path.length) {
    game.destination = null;
    if (game.interaction) {
      const interaction = game.interaction;
      game.interaction = null;
      interact(game, interaction);
    }
  }
  if (game.phase !== "playing") return;
  if (game.preparing) {
    game.preparing.remaining -= dt;
    if (game.preparing.remaining <= 0) {
      game.carrying = game.preparing.food;
      game.preparing = null;
      notify(
        game,
        `${MENU[game.carrying].name} siap! Ketuk pesanan atau meja yang sesuai.`,
      );
      sound(game, "ready");
    }
  }
  for (const customer of game.customers) {
    if (customer.state !== "waiting") {
      advancePath(customer.position, customer.path, 2.25 * dt);
      if (!customer.path.length && customer.state === "entering")
        customer.state = "waiting";
    } else {
      customer.waited += dt;
      customer.patience -= dt;
      if (customer.patience <= 0) {
        customerLeaves(game, customer);
        game.missed++;
        game.combo = 0;
        notify(
          game,
          "Satu pelanggan harus pergi. Tenang, layani yang berikutnya.",
        );
        sound(game, "miss");
      }
    }
  }
  game.customers = game.customers.filter(
    (customer) => customer.state !== "leaving" || customer.path.length > 0,
  );
  tickWaiters(game, dt);
  if (game.elapsed >= game.nextCustomer) {
    spawnCustomer(game);
    game.nextCustomer =
      game.elapsed + Math.max(7, 11 - game.upgrades.expansion);
  }
  if (game.feedback && game.feedback.until < game.elapsed) game.feedback = null;
}
