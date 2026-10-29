import {
  ASSET_PATH,
  COUNTER,
  FOOD_IDS,
  MENU,
  PLANTS,
  PICKUP,
  TABLES,
  TRASH_BIN,
  tableCount,
  project,
  unproject,
  type GameState,
  type Interaction,
  type Point,
} from "./domain";

export type Art = Map<string, HTMLImageElement>;
export type Camera = {
  scale: number;
  x: number;
  y: number;
  width: number;
  height: number;
};
export type SceneOptions = {
  width: number;
  height: number;
  zoom: number;
  reducedMotion: boolean;
};

export async function loadArt(): Promise<Art> {
  const names = [
    "room",
    "table",
    "plant",
    "counter",
    "trash-bin",
    "terrace",
    "pickup",
    ...FOOD_IDS.flatMap((food) => [`station-${food}`, `food-${food}`]),
    ...["front", "back", "side"].flatMap((direction) =>
      [0, 1, 2].map((frame) => `chef-${direction}-${frame}`),
    ),
    ...[0, 1, 2, 3].map((appearance) => `customer-${appearance}`),
    ...[0, 1].flatMap((appearance) =>
      ["front", "back", "side"].flatMap((direction) =>
        [0, 1, 2].map((frame) => `waiter-${appearance}-${direction}-${frame}`),
      ),
    ),
  ];
  return new Map(
    await Promise.all(
      names.map(async (name): Promise<[string, HTMLImageElement]> => {
        const image = new Image();
        image.src = `${ASSET_PATH}/${name}.svg`;
        await image.decode();
        return [name, image];
      }),
    ),
  );
}

export function cameraFor(game: GameState, options: SceneOptions): Camera {
  const { width, height, zoom } = options;
  const worldWidth = game.upgrades.expansion > 0 ? 1260 : 1000;
  const worldHeight = game.upgrades.expansion > 0 ? 850 : 740;
  const availableHeight = Math.max(180, height - 150);
  const fit = Math.min(width / worldWidth, availableHeight / worldHeight);
  const scale =
    (width < 600
      ? Math.max(fit, Math.min(availableHeight / 740, width / 650))
      : fit * 1.06) * zoom;
  const visibleWidth = width / scale;
  const player = project(game.player);
  const centerX =
    visibleWidth >= worldWidth
      ? worldWidth / 2
      : Math.max(
          visibleWidth / 2,
          Math.min(worldWidth - visibleWidth / 2, player.x),
        );
  return {
    scale,
    x: width / 2 - centerX * scale,
    y:
      80 +
      availableHeight / 2 -
      (game.upgrades.expansion > 0 ? 415 : 354) * scale,
    width,
    height,
  };
}

export function screenPoint(point: Point, camera: Camera): Point {
  return {
    x: point.x * camera.scale + camera.x,
    y: point.y * camera.scale + camera.y,
  };
}

export function floorPoint(point: Point, camera: Camera): Point {
  return unproject({
    x: (point.x - camera.x) / camera.scale,
    y: (point.y - camera.y) / camera.scale,
  });
}

function sprite(
  ctx: CanvasRenderingContext2D,
  art: Art,
  name: string,
  point: Point,
  size: { width: number; height: number; anchorX: number; anchorY: number },
  scale = 1,
  mirror = false,
) {
  const image = art.get(name);
  if (!image) return;
  ctx.save();
  ctx.translate(point.x, point.y);
  ctx.scale(mirror ? -scale : scale, scale);
  ctx.drawImage(image, -size.anchorX, -size.anchorY, size.width, size.height);
  ctx.restore();
}

function foodSprite(
  ctx: CanvasRenderingContext2D,
  art: Art,
  name: string,
  point: Point,
  scale = 1,
) {
  sprite(
    ctx,
    art,
    `food-${name}`,
    point,
    { width: 80, height: 92, anchorX: 40, anchorY: 65 },
    scale,
  );
}

export function drawScene(
  ctx: CanvasRenderingContext2D,
  art: Art,
  game: GameState,
  options: SceneOptions,
  now: number,
): Camera {
  const camera = cameraFor(game, options);
  const time = options.reducedMotion ? 0 : now / 1000;
  const clock = options.reducedMotion ? 0 : game.elapsed;
  ctx.clearRect(0, 0, options.width, options.height);
  ctx.save();
  ctx.translate(camera.x, camera.y);
  ctx.scale(camera.scale, camera.scale);
  const terrace = art.get("terrace");
  if (terrace && game.upgrades.expansion > 0)
    ctx.drawImage(terrace, 0, 0, 1260, 850);
  const room = art.get("room");
  if (room) ctx.drawImage(room, 0, 0, 1000, 740);

  if (game.destination && game.phase === "playing") {
    const point = project(game.destination);
    ctx.strokeStyle = "#6c8866";
    ctx.lineWidth = 2;
    ctx.setLineDash([4, 4]);
    ctx.beginPath();
    ctx.ellipse(
      point.x,
      point.y,
      14 + Math.sin(time * 4) * 2,
      7,
      0,
      0,
      Math.PI * 2,
    );
    ctx.stroke();
    ctx.setLineDash([]);
    ctx.fillStyle = "#6c8866";
    ctx.beginPath();
    ctx.arc(point.x, point.y, 2, 0, Math.PI * 2);
    ctx.fill();
  }

  const objects: { depth: number; draw: () => void }[] = [];
  const bin = project(TRASH_BIN.position);
  if (game.carrying && game.phase === "playing") {
    ctx.strokeStyle = "#b47a51";
    ctx.lineWidth = 2;
    ctx.beginPath();
    ctx.ellipse(bin.x, bin.y, 46, 17, 0, 0, Math.PI * 2);
    ctx.stroke();
  }
  objects.push({
    depth: bin.y,
    draw: () =>
      sprite(ctx, art, "trash-bin", bin, {
        width: 108,
        height: 130,
        anchorX: 54,
        anchorY: 104,
      }),
  });
  for (const food of FOOD_IDS) {
    const point = project(MENU[food].position);
    objects.push({
      depth: point.y + 10,
      draw: () =>
        sprite(ctx, art, `station-${food}`, point, {
          width: 200,
          height: 225,
          anchorX: 100,
          anchorY: 165,
        }),
    });
  }
  for (const point of PLANTS) {
    const position = project(point);
    objects.push({
      depth: position.y,
      draw: () =>
        sprite(ctx, art, "plant", position, {
          width: 130,
          height: 145,
          anchorX: 65,
          anchorY: 115,
        }),
    });
  }
  const counter = project(COUNTER.position);
  objects.push({
    depth: counter.y + 8,
    draw: () =>
      sprite(ctx, art, "counter", counter, {
        width: 180,
        height: 180,
        anchorX: 90,
        anchorY: 135,
      }),
  });
  const pickup = project(PICKUP.position);
  objects.push({
    depth: pickup.y,
    draw: () => {
      sprite(ctx, art, "pickup", pickup, {
        width: 130,
        height: 115,
        anchorX: 65,
        anchorY: 88,
      });
      game.readyDishes.forEach((food, index) =>
        foodSprite(
          ctx,
          art,
          food,
          { x: pickup.x - 20 + index * 18, y: pickup.y - 46 },
          0.35,
        ),
      );
    },
  });
  for (const table of TABLES.slice(0, tableCount(game.upgrades.expansion))) {
    const position = project(table);
    objects.push({
      depth: position.y + 4,
      draw: () =>
        sprite(ctx, art, "table", position, {
          width: 210,
          height: 190,
          anchorX: 105,
          anchorY: 140,
        }),
    });
  }
  if (game.upgrades.decor > 0) {
    const left = project({ x: 1, y: 0 });
    const right = project({ x: 8.8, y: 0 });
    ctx.strokeStyle = "#8c7956";
    ctx.lineWidth = 2;
    ctx.beginPath();
    ctx.moveTo(left.x, left.y - 160);
    ctx.quadraticCurveTo(
      (left.x + right.x) / 2,
      (left.y + right.y) / 2 - 115,
      right.x,
      right.y - 160,
    );
    ctx.stroke();
    for (let index = 0; index <= 10; index++) {
      const t = index / 10;
      const x = left.x + (right.x - left.x) * t;
      const y =
        left.y + (right.y - left.y) * t - 160 + Math.sin(t * Math.PI) * 22;
      ctx.fillStyle = game.upgrades.decor > 1 ? "#f5be65" : "#f4dba1";
      ctx.beginPath();
      ctx.ellipse(x, y + 6, 5, 7, 0, 0, Math.PI * 2);
      ctx.fill();
    }
  }
  const previewCustomers =
    game.phase === "ready"
      ? [
          {
            position: { x: TABLES[0].x - 0.55, y: TABLES[0].y - 1.05 },
            appearance: 1,
            state: "waiting",
          },
          {
            position: { x: TABLES[1].x - 0.55, y: TABLES[1].y - 1.05 },
            appearance: 2,
            state: "waiting",
          },
        ]
      : game.customers;
  for (const customer of previewCustomers) {
    const position = project(customer.position);
    const bob = customer.state !== "waiting" ? Math.sin(clock * 13) * 2 : 0;
    objects.push({
      depth: position.y,
      draw: () =>
        sprite(
          ctx,
          art,
          `customer-${customer.appearance}`,
          { x: position.x, y: position.y + bob },
          { width: 90, height: 135, anchorX: 45, anchorY: 120 },
          0.83,
        ),
    });
  }
  for (const waiter of game.waiters) {
    const point = project(waiter.position);
    const next = waiter.path[0];
    const nextPoint = next ? project(next) : point;
    const dx = nextPoint.x - point.x;
    const dy = nextPoint.y - point.y;
    const direction =
      Math.abs(dx) > Math.abs(dy) * 1.5 ? "side" : dy < 0 ? "back" : "front";
    const frame =
      waiter.moving && !options.reducedMotion
        ? (Math.floor(clock * 8) % 2) + 1
        : 0;
    objects.push({
      depth: point.y,
      draw: () => {
        sprite(
          ctx,
          art,
          `waiter-${waiter.id}-${direction}-${frame}`,
          point,
          { width: 90, height: 135, anchorX: 45, anchorY: 120 },
          0.88,
          direction === "side" && dx < 0,
        );
        if (waiter.carrying)
          foodSprite(
            ctx,
            art,
            waiter.carrying,
            { x: point.x + 19, y: point.y - 37 },
            0.48,
          );
        ctx.font = "700 13px 'Geist', sans-serif";
        ctx.textAlign = "center";
        ctx.fillStyle = "#fff8e7";
        ctx.strokeStyle = "#596d5c";
        ctx.lineWidth = 4;
        ctx.strokeText(waiter.id === 0 ? "Aya" : "Ren", point.x, point.y - 113);
        ctx.fillText(waiter.id === 0 ? "Aya" : "Ren", point.x, point.y - 113);
      },
    });
  }
  const player = project(game.player);
  const frame =
    game.moving && !options.reducedMotion ? (Math.floor(clock * 8) % 2) + 1 : 0;
  const direction =
    game.facing === "left" || game.facing === "right" ? "side" : game.facing;
  objects.push({
    depth: player.y,
    draw: () => {
      sprite(
        ctx,
        art,
        `chef-${direction}-${frame}`,
        {
          x: player.x,
          y: player.y + (game.moving ? Math.sin(clock * 16) * 1.5 : 0),
        },
        { width: 90, height: 135, anchorX: 45, anchorY: 120 },
        0.91,
        game.facing === "left",
      );
      if (game.carrying) {
        ctx.fillStyle = "#a37d4e";
        ctx.strokeStyle = "#6e593d";
        ctx.lineWidth = 1.5;
        ctx.beginPath();
        ctx.ellipse(player.x + 19, player.y - 30, 20, 9, 0, 0, Math.PI * 2);
        ctx.fill();
        ctx.stroke();
        foodSprite(
          ctx,
          art,
          game.carrying,
          { x: player.x + 19, y: player.y - 37 },
          0.52,
        );
      }
    },
  });
  objects.sort((a, b) => a.depth - b.depth);
  for (const object of objects) object.draw();

  // Steam is inexpensive feedback over the active stove, not a full-screen filter.
  if (game.preparing) {
    const station = project(MENU[game.preparing.food].position);
    ctx.strokeStyle = "#fffbed";
    ctx.lineWidth = 3;
    ctx.globalAlpha = 0.75;
    for (let i = 0; i < 3; i++) {
      const x = station.x - 15 + i * 14;
      const y = station.y - 110 - ((clock * 22 + i * 11) % 25);
      ctx.beginPath();
      ctx.moveTo(x, y);
      ctx.bezierCurveTo(x - 10, y - 10, x + 10, y - 20, x, y - 30);
      ctx.stroke();
    }
    ctx.globalAlpha = 1;
  }
  if (game.feedback) {
    const point = project(game.feedback.position);
    const age = 1.8 - (game.feedback.until - game.elapsed);
    ctx.globalAlpha = Math.max(
      0,
      Math.min(1, (game.feedback.until - game.elapsed) * 2),
    );
    ctx.font = "800 26px 'Geist', sans-serif";
    ctx.textAlign = "center";
    ctx.lineWidth = 5;
    ctx.strokeStyle = "#fff8dd";
    ctx.fillStyle = game.feedback.tone === "penalty" ? "#a14836" : "#52734c";
    ctx.strokeText(game.feedback.text, point.x + 40, point.y - 128 - age * 26);
    ctx.fillText(game.feedback.text, point.x + 40, point.y - 128 - age * 26);
    ctx.globalAlpha = 1;
  }
  ctx.restore();
  return camera;
}

/** Clicking the furniture also works; its label is a larger, accessible hit target. */
export function hitInteraction(
  game: GameState,
  point: Point,
  camera: Camera,
): Interaction | null {
  const scene = {
    x: (point.x - camera.x) / camera.scale,
    y: (point.y - camera.y) / camera.scale,
  };
  const bin = project(TRASH_BIN.position);
  if (
    Math.abs(scene.x - bin.x) < 45 &&
    scene.y > bin.y - 100 &&
    scene.y < bin.y + 16
  )
    return { kind: "trash" };
  const counter = project(COUNTER.position);
  if (
    Math.abs(scene.x - counter.x) < 58 &&
    scene.y > counter.y - 96 &&
    scene.y < counter.y + 15
  )
    return { kind: "manage" };
  const pickup = project(PICKUP.position);
  if (
    Math.abs(scene.x - pickup.x) < 55 &&
    scene.y > pickup.y - 70 &&
    scene.y < pickup.y + 15
  )
    return { kind: "handoff" };
  const customers = game.customers
    .filter((customer) => customer.state === "waiting")
    .sort((a, b) => project(b.position).y - project(a.position).y);
  for (const customer of customers) {
    const table = project(TABLES[customer.table]);
    if (
      Math.abs(scene.x - table.x) < 65 &&
      scene.y > table.y - 110 &&
      scene.y < table.y + 18
    )
      return { kind: "customer", id: customer.id };
  }
  for (const food of FOOD_IDS) {
    const station = project(MENU[food].position);
    if (
      Math.abs(scene.x - station.x) < 72 &&
      scene.y > station.y - 105 &&
      scene.y < station.y + 15
    )
      return { kind: "station", food };
  }
  return null;
}
