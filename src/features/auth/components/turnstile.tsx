"use client";

import Script from "next/script";
import {
  createContext,
  useContext,
  useEffect,
  useRef,
  useState,
  type ReactNode,
} from "react";
import type { TurnstileAction } from "../lib/turnstile-config";

type TurnstileRenderOptions = {
  sitekey: string;
  action: TurnstileAction;
  appearance: "always" | "execute" | "interaction-only";
  language: string;
  size: "normal" | "flexible" | "compact";
  theme: "light" | "dark" | "auto";
  "response-field": boolean;
  callback: (token: string) => void;
  "error-callback": () => void;
  "expired-callback": () => void;
  "timeout-callback": () => void;
};

type TurnstileApi = {
  render: (container: HTMLElement, options: TurnstileRenderOptions) => string | undefined;
  remove: (widgetId: string) => void;
  reset: (widgetId: string) => void;
};

declare global {
  interface Window {
    turnstile?: TurnstileApi;
  }
}

type TurnstileContextValue = {
  siteKey: string;
  scriptReady: boolean;
  scriptError: boolean;
};

const TurnstileContext = createContext<TurnstileContextValue | null>(null);

export function TurnstileProvider({
  siteKey,
  children,
}: {
  siteKey: string;
  children: ReactNode;
}) {
  const [scriptReady, setScriptReady] = useState(false);
  const [scriptError, setScriptError] = useState(false);

  return (
    <TurnstileContext.Provider value={{ siteKey, scriptReady, scriptError }}>
      {children}
      <Script
        id="cloudflare-turnstile"
        src="https://challenges.cloudflare.com/turnstile/v0/api.js?render=explicit"
        strategy="afterInteractive"
        onLoad={() => {
          setScriptError(false);
          setScriptReady(true);
        }}
        onReady={() => {
          setScriptError(false);
          setScriptReady(true);
        }}
        onError={() => {
          setScriptReady(false);
          setScriptError(true);
        }}
      />
    </TurnstileContext.Provider>
  );
}

export function TurnstileWidget({
  action,
  onTokenChange,
  resetSignal,
}: {
  action: TurnstileAction;
  onTokenChange: (token: string | null) => void;
  resetSignal: number;
}) {
  const context = useContext(TurnstileContext);
  const containerRef = useRef<HTMLDivElement>(null);
  const widgetIdRef = useRef<string | null>(null);
  const onTokenChangeRef = useRef(onTokenChange);
  const previousResetSignalRef = useRef(resetSignal);
  const [error, setError] = useState<string | null>(null);

  if (!context) {
    throw new Error("TurnstileWidget must be rendered inside TurnstileProvider.");
  }

  useEffect(() => {
    onTokenChangeRef.current = onTokenChange;
  }, [onTokenChange]);

  useEffect(() => {
    const turnstile = window.turnstile;
    const container = containerRef.current;
    if (!context.scriptReady || !turnstile || !container || widgetIdRef.current) return;

    setError(null);
    const clearToken = () => onTokenChangeRef.current(null);
    const widgetId = turnstile.render(container, {
      sitekey: context.siteKey,
      action,
      appearance: "always",
      language: "id",
      size: "flexible",
      theme: "light",
      "response-field": false,
      callback: (token) => {
        setError(null);
        onTokenChangeRef.current(token);
      },
      "error-callback": () => {
        clearToken();
        setError("Verifikasi keamanan gagal dimuat. Coba muat ulang halaman.");
      },
      "expired-callback": clearToken,
      "timeout-callback": clearToken,
    });

    if (!widgetId) {
      setError("Verifikasi keamanan gagal dimuat. Coba muat ulang halaman.");
      return;
    }
    widgetIdRef.current = widgetId;

    return () => {
      onTokenChangeRef.current(null);
      window.turnstile?.remove(widgetId);
      widgetIdRef.current = null;
    };
  }, [action, context.scriptReady, context.siteKey]);

  useEffect(() => {
    if (previousResetSignalRef.current === resetSignal) return;
    previousResetSignalRef.current = resetSignal;
    onTokenChangeRef.current(null);
    setError(null);

    const widgetId = widgetIdRef.current;
    if (widgetId) window.turnstile?.reset(widgetId);
  }, [resetSignal]);

  return (
    <div className="grid min-w-0 gap-2">
      <div
        ref={containerRef}
        className="min-h-[65px] w-full min-w-0 overflow-hidden"
        aria-label="Verifikasi keamanan Cloudflare Turnstile"
      />
      {context.scriptError || error ? (
        <p role="alert" className="text-sm font-semibold text-destructive">
          {error ?? "Verifikasi keamanan gagal dimuat. Coba muat ulang halaman."}
        </p>
      ) : null}
    </div>
  );
}
