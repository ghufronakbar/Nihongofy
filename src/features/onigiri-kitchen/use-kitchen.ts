"use client";

import { useCallback, useEffect, useRef, useState } from "react";
import { z } from "zod";
import {
  KITCHEN_STORAGE_KEY,
  buyUpgrade,
  createGame,
  goInteract,
  interact,
  nearbyInteraction,
  pauseGame,
  resumeGame,
  rewardQuest,
  startGame,
  tickGame,
  walkTo,
  type GameState,
  type Interaction,
  type Point,
} from "./domain";
import {
  cameraFor,
  drawScene,
  floorPoint,
  hitInteraction,
  loadArt,
  type Art,
} from "./scene";
import type { UpgradeId } from "./progression";
import { KITCHEN_SAVE_KEY, parseSave, restoreSave, saveSnapshot } from "./save";

const preferenceSchema = z.object({
  bestScore: z.number().int().min(0).max(1_000_000_000),
  sound: z.boolean(),
});
type Preferences = z.infer<typeof preferenceSchema>;
const DEFAULT_PREFERENCES: Preferences = { bestScore: 0, sound: true };

function parseStoredJson(raw: string | null): unknown {
  try {
    return raw === null ? null : JSON.parse(raw);
  } catch {
    return null;
  }
}

class KitchenAudio {
  private context: AudioContext | null = null;

  unlock() {
    try {
      this.context ??= new AudioContext();
      if (this.context.state === "suspended")
        void this.context.resume().catch(() => undefined);
    } catch {
      /* Audio is optional on devices without Web Audio. */
    }
  }

  play(type: GameState["cue"]["type"]) {
    const context = this.context;
    if (!context || context.state !== "running") return;
    const notes =
      type === "serve"
        ? [523.25, 659.25, 783.99]
        : type === "upgrade" || type === "quest"
          ? [659.25, 783.99, 1046.5]
          : type === "ready"
            ? [659.25, 880]
            : type === "arrive"
              ? [587.33]
              : [293.66];
    notes.forEach((frequency, index) => {
      const oscillator = context.createOscillator();
      const gain = context.createGain();
      const at = context.currentTime + index * 0.085;
      oscillator.type = "sine";
      oscillator.frequency.value = frequency;
      gain.gain.setValueAtTime(0, at);
      gain.gain.linearRampToValueAtTime(0.055, at + 0.01);
      gain.gain.exponentialRampToValueAtTime(0.001, at + 0.22);
      oscillator.connect(gain);
      gain.connect(context.destination);
      oscillator.start(at);
      oscillator.stop(at + 0.25);
      oscillator.onended = () => {
        oscillator.disconnect();
        gain.disconnect();
      };
    });
  }

  close() {
    if (this.context && this.context.state !== "closed")
      void this.context.close().catch(() => undefined);
  }
}

export function useKitchen() {
  const scopeRef = useRef<HTMLDivElement>(null);
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const gameRef = useRef<GameState>(createGame());
  const artRef = useRef<Art>(new Map());
  const storageLoaded = useRef(false);
  const keys = useRef(new Set<string>());
  const reducedMotion = useRef(false);
  const audio = useRef<KitchenAudio | null>(null);
  const preferencesRef = useRef<Preferences>(DEFAULT_PREFERENCES);
  const zoomRef = useRef(1);
  const [game, setGame] = useState(createGame);
  const [preferences, setPreferences] =
    useState<Preferences>(DEFAULT_PREFERENCES);
  const [viewport, setViewport] = useState({ width: 1000, height: 740 });
  const [ready, setReady] = useState(false);
  const [error, setError] = useState(false);
  const [storageAvailable, setStorageAvailable] = useState(true);
  const [loadAttempt, setLoadAttempt] = useState(0);
  const [zoom, setZoom] = useState(1);
  const [hasSave, setHasSave] = useState(false);

  const publish = useCallback(
    () => setGame(structuredClone(gameRef.current)),
    [],
  );
  const savePreferences = useCallback((next: Preferences) => {
    preferencesRef.current = next;
    setPreferences(next);
    try {
      localStorage.setItem(KITCHEN_STORAGE_KEY, JSON.stringify(next));
    } catch {
      setStorageAvailable(false);
    }
  }, []);
  const persist = useCallback(() => {
    if (gameRef.current.phase === "ready") return;
    try {
      localStorage.setItem(
        KITCHEN_SAVE_KEY,
        JSON.stringify(saveSnapshot(gameRef.current)),
      );
      setHasSave(true);
    } catch {
      setStorageAvailable(false);
    }
  }, []);

  useEffect(() => {
    let cancelled = false;
    loadArt()
      .then((art) => {
        if (cancelled) return;
        artRef.current = art;
        if (!storageLoaded.current) {
          // One-time hydration; retries load artwork without replacing live progress.
          try {
            const value = parseStoredJson(
              localStorage.getItem(KITCHEN_STORAGE_KEY),
            );
            const parsed = preferenceSchema.safeParse(value);
            if (parsed.success) {
              preferencesRef.current = parsed.data;
              setPreferences(parsed.data);
            }
          } catch {
            setStorageAvailable(false);
          }
          try {
            const savedValue = parseStoredJson(
              localStorage.getItem(KITCHEN_SAVE_KEY),
            );
            const saved = parseSave(savedValue);
            if (saved) {
              gameRef.current = restoreSave(saved);
              setGame(structuredClone(gameRef.current));
              setHasSave(true);
            }
          } catch {
            setStorageAvailable(false);
          }
          storageLoaded.current = true;
        }
        setReady(true);
        setError(false);
      })
      .catch(() => {
        if (!cancelled) setError(true);
      });
    return () => {
      cancelled = true;
    };
  }, [loadAttempt]);

  useEffect(() => {
    const canvas = canvasRef.current;
    if (!canvas) return;
    const resize = () => {
      const rect = canvas.getBoundingClientRect();
      const dpr = Math.min(window.devicePixelRatio || 1, 2);
      canvas.width = Math.round(rect.width * dpr);
      canvas.height = Math.round(rect.height * dpr);
      canvas.getContext("2d")?.setTransform(dpr, 0, 0, dpr, 0, 0);
      setViewport({ width: rect.width, height: rect.height });
    };
    const observer = new ResizeObserver(resize);
    observer.observe(canvas);
    const query = window.matchMedia("(prefers-reduced-motion: reduce)");
    const updateMotion = () => {
      reducedMotion.current = query.matches;
    };
    updateMotion();
    query.addEventListener("change", updateMotion);
    return () => {
      observer.disconnect();
      query.removeEventListener("change", updateMotion);
    };
  }, []);

  useEffect(() => {
    if (!ready) return;
    const canvas = canvasRef.current;
    const context = canvas?.getContext("2d");
    if (!canvas || !context) return;
    let frame = 0;
    let previous = performance.now();
    let lastPublish = 0;
    let lastDraw = 0;
    let lastSave = 0;
    let lastCue = gameRef.current.cue.id;
    const run = (now: number) => {
      const dt = Math.min((now - previous) / 1000, 0.1);
      previous = now;
      const state = gameRef.current;
      const horizontal =
        Number(keys.current.has("arrowright") || keys.current.has("d")) -
        Number(keys.current.has("arrowleft") || keys.current.has("a"));
      const vertical =
        Number(keys.current.has("arrowdown") || keys.current.has("s")) -
        Number(keys.current.has("arrowup") || keys.current.has("w"));
      const movement = { x: horizontal + vertical, y: vertical - horizontal };
      const wasPlaying = state.phase === "playing";
      if (!document.hidden) tickGame(state, dt, movement);
      if (wasPlaying && (now - lastSave > 2000 || state.phase === "paused")) {
        if (state.revenue > preferencesRef.current.bestScore)
          savePreferences({
            ...preferencesRef.current,
            bestScore: state.revenue,
          });
        persist();
        lastSave = now;
      }
      if (wasPlaying && state.phase === "paused") {
        keys.current.clear();
        publish();
      }
      if (state.cue.id !== lastCue) {
        lastCue = state.cue.id;
        if (preferencesRef.current.sound) audio.current?.play(state.cue.type);
      }
      if (
        !document.hidden &&
        (state.phase === "playing" || now - lastDraw > 100)
      ) {
        drawScene(
          context,
          artRef.current,
          state,
          {
            ...viewport,
            zoom: zoomRef.current,
            reducedMotion: reducedMotion.current,
          },
          now,
        );
        lastDraw = now;
      }
      if (now - lastPublish > 100 && state.phase === "playing") {
        publish();
        lastPublish = now;
      }
      frame = requestAnimationFrame(run);
    };
    frame = requestAnimationFrame(run);
    return () => cancelAnimationFrame(frame);
  }, [ready, viewport, publish, savePreferences, persist]);

  useEffect(() => {
    const onKeyDown = (event: KeyboardEvent) => {
      if (
        event.defaultPrevented ||
        document.activeElement?.closest('[role="dialog"]') ||
        !scopeRef.current?.contains(document.activeElement) ||
        event.altKey ||
        event.ctrlKey ||
        event.metaKey
      )
        return;
      const key = event.key.toLowerCase();
      if (
        [
          "arrowup",
          "arrowdown",
          "arrowleft",
          "arrowright",
          "w",
          "a",
          "s",
          "d",
        ].includes(key) &&
        gameRef.current.phase === "playing"
      ) {
        event.preventDefault();
        keys.current.add(key);
      }
      if (
        (key === "e" || key === " ") &&
        !event.repeat &&
        gameRef.current.phase === "playing"
      ) {
        // Space on a real button retains its native activation behavior.
        if (key === " " && document.activeElement !== canvasRef.current) return;
        event.preventDefault();
        const target = nearbyInteraction(gameRef.current);
        if (target) interact(gameRef.current, target);
        publish();
        persist();
      }
      if (key === "escape" && !event.repeat) {
        keys.current.clear();
        if (gameRef.current.phase === "playing") pauseGame(gameRef.current);
        else resumeGame(gameRef.current);
        publish();
        persist();
      }
    };
    const onKeyUp = (event: KeyboardEvent) => {
      keys.current.delete(event.key.toLowerCase());
    };
    const autoPause = () => {
      keys.current.clear();
      pauseGame(gameRef.current);
      publish();
      persist();
    };
    const onVisibility = () => {
      if (document.hidden) autoPause();
    };
    window.addEventListener("keydown", onKeyDown);
    window.addEventListener("keyup", onKeyUp);
    window.addEventListener("blur", autoPause);
    window.addEventListener("pagehide", autoPause);
    document.addEventListener("visibilitychange", onVisibility);
    return () => {
      window.removeEventListener("keydown", onKeyDown);
      window.removeEventListener("keyup", onKeyUp);
      window.removeEventListener("blur", autoPause);
      window.removeEventListener("pagehide", autoPause);
      document.removeEventListener("visibilitychange", onVisibility);
    };
  }, [publish, persist]);

  useEffect(() => () => audio.current?.close(), []);

  const focusCanvas = () => canvasRef.current?.focus({ preventScroll: true });
  const start = () => {
    if (!ready) return;
    keys.current.clear();
    if (hasSave) gameRef.current.phase = "playing";
    else gameRef.current = startGame();
    if (preferencesRef.current.sound) {
      audio.current ??= new KitchenAudio();
      audio.current.unlock();
    }
    publish();
    persist();
    focusCanvas();
    scopeRef.current?.scrollIntoView({
      block: "start",
      behavior: reducedMotion.current ? "instant" : "smooth",
    });
  };
  const pause = () => {
    keys.current.clear();
    pauseGame(gameRef.current);
    publish();
    persist();
  };
  const resume = () => {
    keys.current.clear();
    resumeGame(gameRef.current);
    publish();
    focusCanvas();
  };
  const action = (interaction: Interaction) => {
    goInteract(gameRef.current, interaction);
    publish();
    focusCanvas();
  };
  const onFloorPointer = (point: Point) => {
    if (gameRef.current.phase !== "playing") return;
    const camera = cameraFor(gameRef.current, {
      ...viewport,
      zoom: zoomRef.current,
      reducedMotion: reducedMotion.current,
    });
    const target = hitInteraction(gameRef.current, point, camera);
    if (target) goInteract(gameRef.current, target);
    else walkTo(gameRef.current, floorPoint(point, camera));
    publish();
    focusCanvas();
  };
  const toggleSound = () => {
    const enabled = !preferencesRef.current.sound;
    savePreferences({ ...preferencesRef.current, sound: enabled });
    if (enabled) {
      audio.current ??= new KitchenAudio();
      audio.current.unlock();
      audio.current.play("ready");
    }
  };
  const toggleZoom = () => {
    zoomRef.current = zoomRef.current === 1 ? 1.25 : 1;
    setZoom(zoomRef.current);
  };
  const useNearby = () => {
    const target = nearbyInteraction(gameRef.current);
    if (target) interact(gameRef.current, target);
    publish();
    focusCanvas();
  };
  const retry = () => {
    setError(false);
    setLoadAttempt((attempt) => attempt + 1);
  };
  const upgrade = (id: UpgradeId) => {
    buyUpgrade(gameRef.current, id);
    publish();
    persist();
  };
  const claim = (id: string) => {
    rewardQuest(gameRef.current, id);
    publish();
    persist();
  };
  const camera = cameraFor(game, { ...viewport, zoom, reducedMotion: false });
  return {
    scopeRef,
    canvasRef,
    game,
    preferences,
    ready,
    error,
    storageAvailable,
    hasSave,
    zoom,
    viewport,
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
  };
}
