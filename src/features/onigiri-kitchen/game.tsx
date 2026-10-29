"use client";

import Image from "next/image";
import { useEffect, useRef, useState, type CSSProperties } from "react";
import {
  ArrowRight,
  ChefHat,
  CircleHelp,
  Coffee,
  Coins,
  Heart,
  Keyboard,
  Maximize2,
  Minimize2,
  MousePointer2,
  Pause,
  Play,
  ShoppingBag,
  Trash2,
  Users,
  Volume2,
  VolumeX,
  ZoomIn,
  ZoomOut,
} from "lucide-react";
import { Button } from "@/components/ui/button";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { cn } from "@/lib/utils";
import {
  ASSET_PATH,
  COUNTER,
  FOOD_IDS,
  MENU,
  PICKUP,
  TABLES,
  TRASH_BIN,
  nearbyInteraction,
  project,
  tableCount,
  type FoodId,
  type Interaction,
} from "./domain";
import { ManagementPanel, QuestJournal, yen } from "./panels";
import { screenPoint } from "./scene";
import { useKitchen } from "./use-kitchen";

function FoodArt({ food, size = 44 }: { food: FoodId; size?: number }) {
  return (
    <Image
      src={`${ASSET_PATH}/food-${food}.svg`}
      alt=""
      width={size}
      height={Math.round(size * 1.15)}
      draggable={false}
    />
  );
}

export function OnigiriKitchen() {
  const {
    scopeRef,
    canvasRef,
    game,
    preferences,
    ready,
    error,
    storageAvailable,
    hasSave,
    zoom,
    camera,
    start,
    pause,
    resume,
    action,
    onFloorPointer,
    toggleSound,
    toggleZoom,
    useNearby,
    retry,
    upgrade,
    claim,
  } = useKitchen();
  const [help, setHelp] = useState(false);
  const [fullscreen, setFullscreen] = useState(false);
  const resumeRef = useRef<HTMLButtonElement>(null);
  const playing = game.phase === "playing";
  const activeCustomers = game.customers.filter(
    (customer) => customer.state !== "leaving",
  );
  const target = nearbyInteraction(game);

  useEffect(() => {
    const change = () =>
      setFullscreen(document.fullscreenElement === scopeRef.current);
    document.addEventListener("fullscreenchange", change);
    return () => document.removeEventListener("fullscreenchange", change);
  }, [scopeRef]);

  useEffect(() => {
    if (!fullscreen) return;
    const previous = document.body.style.overflow;
    document.body.style.overflow = "hidden";
    const exit = (event: KeyboardEvent) => {
      if (
        event.key === "Escape" &&
        !document.fullscreenElement &&
        !document.activeElement?.closest('[role="dialog"]')
      ) {
        event.preventDefault();
        event.stopPropagation();
        setFullscreen(false);
      }
    };
    window.addEventListener("keydown", exit, true);
    return () => {
      document.body.style.overflow = previous;
      window.removeEventListener("keydown", exit, true);
    };
  }, [fullscreen]);

  useEffect(() => {
    if (game.phase === "paused" && !help && !game.panel)
      resumeRef.current?.focus({ preventScroll: true });
  }, [game.phase, game.panel, help]);

  async function toggleFullscreen() {
    if (fullscreen) {
      if (document.fullscreenElement)
        await document.exitFullscreen().catch(() => undefined);
      setFullscreen(false);
      return;
    }
    setFullscreen(true);
    if (document.fullscreenEnabled && scopeRef.current?.requestFullscreen) {
      // Browsers without native fullscreen still receive a viewport-filling game.
      await scopeRef.current.requestFullscreen().catch(() => undefined);
    }
  }

  function showHelp() {
    pause();
    setHelp(true);
  }
  function doAction(interaction: Interaction) {
    if (playing) action(interaction);
  }
  function markerStyle(
    position: { x: number; y: number },
    inset = 0,
  ): CSSProperties {
    const point = screenPoint(position, camera);
    return {
      "--marker-x": `${inset ? Math.max(inset, Math.min(camera.width - inset, point.x)) : point.x}px`,
      "--marker-y": `${point.y}px`,
    } as CSSProperties;
  }
  const nearbyLabel =
    target?.kind === "station"
      ? `Siapkan ${MENU[target.food].name}`
      : target?.kind === "customer"
        ? "Layani pelanggan"
        : target?.kind === "trash"
          ? game.carrying
            ? `Buang menu (−¥${TRASH_BIN.penalty})`
            : "Nampan sudah kosong"
          : target?.kind === "manage"
            ? "Kelola kedai"
            : target?.kind === "handoff"
              ? game.carrying
                ? "Taruh untuk pelayan"
                : "Meja pengambilan"
              : "Dekati objek · tekan E";

  return (
    <div
      className={cn(
        "kitchen-app",
        fullscreen && "kitchen-fullscreen",
        (help || game.panel) && "kitchen-modal-open",
      )}
      ref={scopeRef}
    >
      <div className="kitchen-toolbar">
        <div className="kitchen-shop-mark">
          <span className="kitchen-mark-icon">
            <ChefHat size={22} />
          </span>
          <div>
            <strong>Kome &amp; Ocha</strong>
            <span lang="ja">こめと、おちゃ。</span>
          </div>
          <span className="kitchen-open-sign" data-open={playing}>
            {playing ? "BUKA" : "KEDAI KECILMU"}
          </span>
        </div>
        <div className="kitchen-tools">
          <Button
            variant="ghost"
            size="icon"
            className="kitchen-icon-button"
            onClick={showHelp}
            aria-label="Cara bermain"
          >
            <CircleHelp />
          </Button>
          <Button
            variant="ghost"
            size="icon"
            className="kitchen-icon-button"
            onClick={toggleSound}
            aria-label={preferences.sound ? "Matikan suara" : "Aktifkan suara"}
            aria-pressed={preferences.sound}
          >
            {preferences.sound ? <Volume2 /> : <VolumeX />}
          </Button>
          <Button
            variant="ghost"
            size="icon"
            className="kitchen-icon-button kitchen-zoom-button"
            onClick={toggleZoom}
            aria-label={zoom > 1 ? "Perkecil tampilan" : "Perbesar tampilan"}
          >
            {zoom > 1 ? <ZoomOut /> : <ZoomIn />}
          </Button>
          <Button
            variant="outline"
            className="kitchen-pause-button"
            onClick={game.phase === "paused" ? resume : pause}
            disabled={game.phase === "ready"}
            aria-label={
              game.phase === "paused" ? "Lanjutkan permainan" : "Jeda permainan"
            }
          >
            {game.phase === "paused" ? <Play /> : <Pause />}
            <span>{game.phase === "paused" ? "Lanjut" : "Jeda"}</span>
          </Button>
        </div>
        <Button
          variant="outline"
          className="kitchen-fullscreen-button"
          onClick={toggleFullscreen}
          aria-label={fullscreen ? "Keluar layar penuh" : "Layar penuh"}
          aria-pressed={fullscreen}
        >
          {fullscreen ? <Minimize2 size={16} /> : <Maximize2 size={16} />}
          <span>{fullscreen ? "Perkecil" : "Layar penuh"}</span>
        </Button>
      </div>

      <div className="kitchen-stage">
        <canvas
          ref={canvasRef}
          className="kitchen-canvas"
          tabIndex={0}
          aria-label="Area permainan kafe isometrik. Klik lantai atau gunakan WASD dan tombol panah untuk berjalan. Tekan E di dekat dapur, pelanggan, tong sampah, atau meja pengambilan."
          onPointerUp={(event) => {
            if (event.button !== 0) return;
            const rect = event.currentTarget.getBoundingClientRect();
            onFloorPointer({
              x: event.clientX - rect.left,
              y: event.clientY - rect.top,
            });
          }}
        />

        <div className="kitchen-scene-hud">
          <div
            className="kitchen-wallet"
            aria-label={`Uang kedai ${yen(game.score)}`}
          >
            <Coins size={21} />
            <span>
              <small>Uang kedai</small>
              <strong>{yen(game.score)}</strong>
            </span>
          </div>
          <div className="kitchen-scene-stats">
            <span>
              <Users size={15} />
              {game.served}
              <small>terlayani</small>
            </span>
            <span data-active={game.combo > 1}>
              <Heart
                size={15}
                fill={game.combo > 1 ? "currentColor" : "none"}
              />
              ×{game.combo}
            </span>
          </div>
        </div>
        {ready && game.phase !== "ready" && (
          <QuestJournal game={game} claim={claim} />
        )}

        {ready && playing && (
          <div className="kitchen-scene-labels">
            <button
              type="button"
              className="kitchen-object-label kitchen-management-label"
              style={markerStyle(
                {
                  x: project(COUNTER.position).x,
                  y: project(COUNTER.position).y - 116,
                },
                62,
              )}
              onClick={() => doAction({ kind: "manage" })}
              aria-label="Kelola kedai: upgrade, perluasan, dan pelayan"
            >
              <ShoppingBag size={16} />
              <span>
                Kelola kedai<small>Upgrade · tim · teras</small>
              </span>
            </button>
            <button
              type="button"
              className="kitchen-object-label kitchen-pickup-label"
              style={markerStyle(
                {
                  x: project(PICKUP.position).x,
                  y: project(PICKUP.position).y - 85,
                },
                66,
              )}
              onClick={() => doAction({ kind: "handoff" })}
              aria-label="Meja pengambilan: taruh menu untuk pelayan"
              data-ready={game.upgrades.waiter > 0 && Boolean(game.carrying)}
            >
              <Users size={16} />
              <span>
                Meja pelayan
                <small>
                  {game.upgrades.waiter
                    ? `${game.readyDishes.length}/${PICKUP.capacity} menu siap`
                    : "Rekrut di Kelola kedai"}
                </small>
              </span>
            </button>
            <button
              type="button"
              className="kitchen-trash-label"
              data-carrying={Boolean(game.carrying)}
              style={markerStyle(
                {
                  x: project(TRASH_BIN.position).x,
                  y: project(TRASH_BIN.position).y - 103,
                },
                62,
              )}
              onClick={() => doAction({ kind: "trash" })}
              aria-label={`Tong sampah: buang menu, penalti ¥${TRASH_BIN.penalty}`}
            >
              <Trash2 size={17} />
              <span>
                <strong>Tong sampah</strong>
                <small>−¥{TRASH_BIN.penalty} / menu</small>
              </span>
            </button>
            {FOOD_IDS.map((food) => {
              const point = project(MENU[food].position);
              const wanted = activeCustomers.some(
                (customer) =>
                  customer.remaining.includes(food) &&
                  customer.state === "waiting",
              );
              return (
                <button
                  key={food}
                  type="button"
                  className="kitchen-station-label"
                  data-food={food}
                  data-wanted={wanted && !game.carrying}
                  style={markerStyle({ x: point.x, y: point.y - 131 })}
                  onClick={() => doAction({ kind: "station", food })}
                  aria-label={`Siapkan ${MENU[food].name}`}
                >
                  <FoodArt food={food} size={26} />
                  <span lang="ja">{MENU[food].japanese}</span>
                  {game.upgrades.stove > 0 && (
                    <small>+{game.upgrades.stove}</small>
                  )}
                  {game.preparing?.food === food && (
                    <span
                      className="kitchen-preparation"
                      style={{
                        transform: `scaleX(${1 - game.preparing.remaining / game.preparing.duration})`,
                      }}
                    />
                  )}
                </button>
              );
            })}
            {activeCustomers
              .filter((customer) => customer.state === "waiting")
              .map((customer) => {
                const point = project(TABLES[customer.table]);
                return (
                  <button
                    key={customer.id}
                    type="button"
                    className="kitchen-customer-bubble"
                    data-correct={Boolean(
                      game.carrying &&
                      customer.remaining.includes(game.carrying),
                    )}
                    data-vip={customer.vip}
                    style={markerStyle(
                      { x: point.x + 38, y: point.y - 127 },
                      60,
                    )}
                    onClick={() =>
                      doAction({ kind: "customer", id: customer.id })
                    }
                    aria-label={`Antar ${customer.remaining.map((food) => MENU[food].name).join(" dan ")} ke meja ${customer.table + 1}${customer.vip ? ", VIP" : ""}`}
                  >
                    <span className="kitchen-bubble-heading">
                      {customer.vip ? "VIP · " : ""}Meja {customer.table + 1}
                      <small>
                        {customer.order.length > 1
                          ? `${customer.order.length - customer.remaining.length}/${customer.order.length}`
                          : ""}
                      </small>
                    </span>
                    <span className="kitchen-bubble-foods">
                      {customer.remaining.map((food, index) => (
                        <span key={`${food}-${index}`}>
                          <FoodArt food={food} size={31} />
                          <strong lang="ja">{MENU[food].japanese}</strong>
                        </span>
                      ))}
                    </span>
                    <span
                      className="kitchen-bubble-patience"
                      data-urgent={customer.patience < 15}
                    >
                      <span
                        style={{
                          transform: `scaleX(${Math.max(0, customer.patience / customer.maxPatience)})`,
                        }}
                      />
                    </span>
                  </button>
                );
              })}
          </div>
        )}

        {!ready && (
          <div className="kitchen-stage-overlay">
            <div className="kitchen-loading">
              <ChefHat size={36} />
              <h2>{error ? "Dapur belum siap" : "Menata kedai kecilmu…"}</h2>
              <p>
                {error
                  ? "Ada ilustrasi yang gagal dimuat. Coba muat ulang aset."
                  : "Menyiapkan meja, menu, dan apron."}
              </p>
              {error && (
                <Button className="kitchen-primary" onClick={retry}>
                  Coba lagi
                </Button>
              )}
            </div>
          </div>
        )}

        {ready && game.phase === "ready" && (
          <section
            className="kitchen-welcome"
            aria-labelledby="kitchen-welcome-title"
          >
            <span className="kitchen-welcome-stamp">
              <Coffee size={15} /> KEDAI KECIL, CERITA PANJANG
            </span>
            <h2 id="kitchen-welcome-title">
              Masak. Layani.
              <br />
              Tumbuh bersama.
            </h2>
            <p>
              {hasSave
                ? "Meja, uang, dan progres kedaimu sudah tersimpan. Lanjutkan cerita dari tempat terakhir."
                : "Mulai dari tiga meja. Selesaikan quest, ajak pelayan bergabung, dan buka terasmu sendiri."}
            </p>
            <Button className="kitchen-primary" onClick={start}>
              {hasSave ? "Lanjutkan kedai" : "Buka kedai"}
              <ArrowRight size={17} />
            </Button>
            <span className="kitchen-welcome-note">
              Tanpa batas waktu · Progres tersimpan otomatis
            </span>
          </section>
        )}

        {game.phase === "paused" && !game.panel && !help && (
          <div className="kitchen-stage-overlay kitchen-pause-overlay">
            <section
              className="kitchen-pause-card"
              aria-labelledby="kitchen-pause-title"
            >
              <span className="kitchen-pause-illustration">
                <Coffee size={40} />
              </span>
              <h2 id="kitchen-pause-title">Istirahat sebentar.</h2>
              <p>
                Pelanggan dan tim ikut menunggu.
                <br />
                Progres kedaimu sudah disimpan.
              </p>
              <Button
                ref={resumeRef}
                className="kitchen-primary"
                onClick={resume}
              >
                <Play size={17} />
                Lanjutkan bermain
              </Button>
              <button
                type="button"
                className="kitchen-text-button"
                onClick={showHelp}
              >
                Lihat cara bermain
              </button>
            </section>
          </div>
        )}

        {ready && game.phase !== "ready" && (
          <>
            <p
              className="kitchen-scene-message"
              role="status"
              aria-live="polite"
            >
              {game.message}
            </p>
            <div className="kitchen-stage-dock">
              <div className="kitchen-tray">
                <span className="kitchen-tray-art">
                  {game.carrying ? (
                    <FoodArt food={game.carrying} size={31} />
                  ) : (
                    <ChefHat size={23} />
                  )}
                </span>
                <span>
                  <small>NAMPANMU</small>
                  <strong>
                    {game.preparing
                      ? "Sedang menyiapkan…"
                      : game.carrying
                        ? MENU[game.carrying].name
                        : "Siap memasak"}
                  </strong>
                </span>
              </div>
              <Button
                variant="outline"
                className="kitchen-interact-button"
                disabled={
                  !playing ||
                  !target ||
                  Boolean(game.preparing) ||
                  (target.kind === "trash" && !game.carrying)
                }
                onClick={useNearby}
              >
                <span>{game.preparing ? "Memasak…" : nearbyLabel}</span>
                <kbd>E</kbd>
              </Button>
            </div>
          </>
        )}
      </div>

      <div className="kitchen-status-bar">
        <span>
          <MousePointer2 size={13} />
          Klik / tap untuk bergerak
          <span className="kitchen-keyboard-tip">
            <Keyboard size={14} />
            WASD · E interaksi · Esc jeda
          </span>
        </span>
        <span>
          {storageAvailable
            ? "Progres tersimpan di perangkat ini"
            : "Penyimpanan tidak tersedia; progres hanya bertahan di halaman"}{" "}
          · {tableCount(game.upgrades.expansion)} meja
        </span>
      </div>

      <ManagementPanel
        game={game}
        container={scopeRef}
        close={resume}
        upgrade={upgrade}
      />
      <Dialog open={help} onOpenChange={setHelp}>
        <DialogContent
          portalContainer={scopeRef}
          overlayClassName="kitchen-modal-backdrop"
          className="kitchen-help-dialog sm:max-w-lg"
        >
          <DialogHeader>
            <span className="kitchen-help-icon">
              <ChefHat size={30} />
            </span>
            <DialogTitle className="text-2xl font-extrabold">
              Selamat datang, chef.
            </DialogTitle>
            <DialogDescription>
              Jalankan kedai sesantai yang kamu mau. Tidak ada batas waktu
              bermain.
            </DialogDescription>
          </DialogHeader>
          <ol className="kitchen-help-steps">
            <li>
              <span>1</span>
              <div>
                <strong>Masak dan antar pesanan</strong>
                <p>
                  Ketuk dapur, lalu gelembung pelanggan yang cocok. Beberapa
                  pelanggan memesan dua menu. VIP membayar lebih.
                </p>
              </div>
            </li>
            <li>
              <span>2</span>
              <div>
                <strong>Ikuti catatan kedai</strong>
                <p>
                  Buka quest di kiri atas arena. Klaim hadiah setelah tujuannya
                  tercapai untuk menambah uang kedai.
                </p>
              </div>
            </li>
            <li>
              <span>3</span>
              <div>
                <strong>Kembangkan kedai dan tim</strong>
                <p>
                  Ketuk Kelola kedai untuk upgrade dapur, gerak, dekorasi,
                  teras, atau merekrut Aya dan Ren. Taruh masakan di meja
                  pelayan; mereka mengantarnya ke pelanggan yang sesuai.
                </p>
              </div>
            </li>
            <li>
              <span>4</span>
              <div>
                <strong>Salah ambil? Gunakan tong sampah</strong>
                <p>
                  Ketuk tong di kanan dapur. Membuang satu menu mengurangi uang
                  ¥{TRASH_BIN.penalty}, minimum ¥0.
                </p>
              </div>
            </li>
          </ol>
          <div className="kitchen-help-controls">
            <span>
              <MousePointer2 size={17} />
              Klik / tap lantai untuk berjalan
            </span>
            <span>
              <Keyboard size={17} />
              WASD / panah · E interaksi · Esc jeda
            </span>
          </div>
          <Button
            className="kitchen-primary"
            onClick={() => {
              setHelp(false);
              if (game.phase === "paused") resume();
            }}
          >
            Siap, chef! <ArrowRight size={17} />
          </Button>
        </DialogContent>
      </Dialog>
    </div>
  );
}
