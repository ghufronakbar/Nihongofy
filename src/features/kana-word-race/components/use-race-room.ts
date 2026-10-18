"use client";
import { useCallback, useEffect, useRef, useState } from "react";
import { ServerMessageSchema, type RaceCommand, type RaceSnapshot } from "../contracts";

export function useRaceRoom(initial: RaceSnapshot | null, live = true) {
  const [state, setState] = useState(initial);
  const [status, setStatus] = useState("connecting");
  const [error, setError] = useState<string | null>(null);
  const [online, setOnline] = useState<string[]>([]);
  const [pending, setPending] = useState(false);
  const [now, setNow] = useState(initial?.serverNow ?? 0);
  const [generation, setGeneration] = useState(0);
  const socket = useRef<WebSocket | null>(null);
  const waiting = useRef<RaceCommand | null>(null);
  const anchor = useRef({ server: initial?.serverNow ?? 0, local: 0 });
  const latest = useRef(initial);
  const roomId = state?.roomId;
  const closed = state?.closed ?? false;
  const accept = useCallback((incoming: RaceSnapshot) => {
    if (latest.current && latest.current.serverNow > incoming.serverNow) return;
    latest.current = incoming; anchor.current = { server: incoming.serverNow, local: performance.now() };
    setState(incoming); setNow(incoming.serverNow);
  }, []);
  useEffect(() => {
    anchor.current.local = performance.now();
    const clock = setInterval(() => setNow(anchor.current.server + performance.now() - anchor.current.local), 250);
    return () => clearInterval(clock);
  }, []);
  useEffect(() => {
    if (!live || !roomId || closed) return;
    let stopped = false; let attempts = 0; let terminal = false;
    let retry: ReturnType<typeof setTimeout> | undefined;
    function connect() {
      if (stopped) return;
      setStatus(attempts ? "reconnecting" : "connecting");
      const url = new URL("/api/mini-games/kana-word-race/ws", location.origin);
      url.protocol = location.protocol === "https:" ? "wss:" : "ws:";
      url.searchParams.set("room", roomId!);
      const ws = new WebSocket(url); socket.current = ws;
      let lastMessageAt = performance.now();
      const watchdog = setInterval(() => { if (performance.now() - lastMessageAt > 45000) ws.close(); }, 10000);
      let replayed = false;
      ws.onmessage = (event: MessageEvent<unknown>) => {
        if (stopped || socket.current !== ws || typeof event.data !== "string") return;
        lastMessageAt = performance.now();
        try {
          const raw: unknown = JSON.parse(event.data);
          const message = ServerMessageSchema.parse(raw);
          if (message.type === "snapshot") {
            attempts = 0; setStatus(message.state.closed ? "closed" : "online"); setOnline(message.online); accept(message.state);
            const command = waiting.current;
            if (command?.type === "guess" && message.state.match?.id === command.matchId && message.state.match.guesses.some((guess) => guess.requestId === command.requestId)) { waiting.current = null; setPending(false); }
            else if (command && !replayed) { replayed = true; ws.send(JSON.stringify(command)); }
            if (message.state.closed) { terminal = true; ws.close(); }
          } else if (message.type === "ack") {
            if (waiting.current?.requestId === message.requestId) { waiting.current = null; setPending(false); setError(null); }
          } else {
            setError(message.message);
            if (message.requestId === waiting.current?.requestId || message.terminal) { waiting.current = null; setPending(false); }
            if (message.terminal) { terminal = true; setStatus("closed"); ws.close(); }
          }
        } catch { terminal = true; setStatus("closed"); setError("Versi koneksi tidak cocok. Muat ulang halaman."); ws.close(1002); }
      };
      ws.onclose = (event) => {
        clearInterval(watchdog);
        if (stopped || socket.current !== ws) return;
        socket.current = null; setOnline([]);
        if (terminal || event.code === 4003 || event.code === 4004) { setStatus("closed"); return; }
        setStatus("reconnecting");
        retry = setTimeout(connect, Math.min(15000, 800 * 2 ** attempts++) + Math.random() * 400);
      };
      ws.onerror = () => ws.close();
    }
    connect();
    return () => { stopped = true; clearTimeout(retry); socket.current?.close(); socket.current = null; };
  }, [roomId, closed, accept, generation, live]);
  function send(command: RaceCommand) {
    if (waiting.current || socket.current?.readyState !== WebSocket.OPEN) { setError("Tunggu koneksi siap sebelum mengirim."); return; }
    waiting.current = command; setPending(true); setError(null); socket.current.send(JSON.stringify(command));
  }
  return { state, status, error, online, pending, now, send, accept, reconnect: () => setGeneration((value) => value + 1) };
}
