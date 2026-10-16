"use client";

import { useCallback, useEffect, useRef, useState } from "react";
import { ClashServerMessageSchema, type ClashRoomSnapshot } from "../contracts";
import type { ClashClientMessage } from "../schemas";

type AnswerMessage = Extract<ClashClientMessage, { type: "submit_answer" }>;
export type ClashConnectionStatus = "connecting" | "online" | "reconnecting" | "replaced" | "closed";

export function useClashRoom(initial: ClashRoomSnapshot | null) {
  const [state, setState] = useState(initial);
  const [status, setStatus] = useState<ClashConnectionStatus>("connecting");
  const [error, setError] = useState<string | null>(null);
  const [now, setNow] = useState(initial?.serverNow ?? 0);
  const [pendingRound, setPendingRound] = useState<string | null>(null);
  const [generation, setGeneration] = useState(0);
  const anchor = useRef({ serverNow: initial?.serverNow ?? 0, receivedAt: 0 });
  const socket = useRef<WebSocket | null>(null);
  const pending = useRef<AnswerMessage | null>(null);
  const roomId = state?.id;
  const latest = useRef(initial);

  const accept = useCallback((incoming: ClashRoomSnapshot) => {
    if (latest.current && (latest.current.revision > incoming.revision || latest.current.serverNow > incoming.serverNow)) return;
    latest.current = incoming;
    anchor.current = { serverNow: incoming.serverNow, receivedAt: performance.now() };
    setNow(incoming.serverNow);
    setState(incoming);
  }, []);

  useEffect(() => {
    anchor.current.receivedAt = performance.now();
    const clock = setInterval(() => { setNow(anchor.current.serverNow + performance.now() - anchor.current.receivedAt); }, 250);
    return () => clearInterval(clock);
  }, []);

  const [online, setOnline] = useState<string[]>([]);
  useEffect(() => {
    if (!roomId) return;
    let stopped = false;
    let attempts = 0;
    let reconnect: ReturnType<typeof setTimeout> | undefined;
    let sentPendingOn: WebSocket | null = null;
    function connect() {
      if (stopped) return;
      setStatus(attempts > 0 ? "reconnecting" : "connecting");
      const url = new URL("/api/mini-games/kotoba-clash/ws", window.location.origin);
      url.protocol = window.location.protocol === "https:" ? "wss:" : "ws:";
      url.searchParams.set("room", roomId!);
      const ws = new WebSocket(url);
      socket.current = ws;
      ws.onmessage = (event: MessageEvent<unknown>) => {
        if (stopped || socket.current !== ws || typeof event.data !== "string") return;
        try {
          const raw: unknown = JSON.parse(event.data);
          const message = ClashServerMessageSchema.parse(raw);
          if (message.type === "snapshot") {
            attempts = 0;
            setStatus("online");
            setError(null);
            accept(message.state);
            setOnline(message.online);
            const waiting = pending.current;
            if (waiting && message.state.match?.round?.id === waiting.roundId && message.state.match.ownAnswer) {
              pending.current = null;
              setPendingRound(null);
            } else if (waiting && sentPendingOn !== ws) {
              sentPendingOn = ws;
              ws.send(JSON.stringify(waiting));
            }
          } else if (message.type === "answer_ack") {
            if (pending.current?.requestId === message.requestId) {
              const choice = pending.current.choice;
              setState((current) => current?.match?.round?.id === message.roundId ? {
                ...current, match: { ...current.match, ownAnswer: { choice, acceptedAt: message.acceptedAt } },
              } : current);
              pending.current = null;
              setPendingRound(null);
            }
          } else {
            setError(message.message);
            if (pending.current?.requestId === message.requestId) { pending.current = null; setPendingRound(null); }
          }
        } catch {
          setError("Data koneksi tidak cocok. Muat ulang halaman.");
          ws.close(1002, "Invalid protocol");
        }
      };
      ws.onclose = (event) => {
        if (stopped || socket.current !== ws) return;
        socket.current = null;
        setOnline([]);
        if (event.code === 4009) { setStatus("replaced"); return; }
        if (event.code === 4003 || event.code === 4004 || event.code === 1002) { setStatus("closed"); return; }
        setStatus("reconnecting");
        attempts++;
        reconnect = setTimeout(connect, Math.min(30_000, 750 * 2 ** Math.min(attempts, 6)) * (0.8 + Math.random() * 0.4));
      };
      ws.onerror = () => { setError("Koneksi realtime belum tersedia. Mencoba menyambungkan kembali..."); };
    }
    connect();
    return () => { stopped = true; clearTimeout(reconnect); socket.current?.close(1000, "Leaving room"); socket.current = null; };
  }, [roomId, generation, accept]);

  function answer(choice: number) {
    const match = state?.match;
    const ws = socket.current;
    if (!state || !match?.round || match.phase.type !== "QUESTION" || !match.playing || match.ownAnswer || pending.current || status !== "online" || !ws || ws.readyState !== WebSocket.OPEN) return;
    const message: AnswerMessage = {
      protocolVersion: 1, type: "submit_answer", requestId: crypto.randomUUID(), roomId: state.id,
      matchId: match.id, roundId: match.round.id, choice,
    };
    pending.current = message;
    setPendingRound(message.roundId);
    ws.send(JSON.stringify(message));
  }

  return { state, status, online, now, error, setError, accept, answer, pendingRound, reconnect: () => setGeneration((value) => value + 1) };
}
