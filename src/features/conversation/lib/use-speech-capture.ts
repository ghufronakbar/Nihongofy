"use client";

import { useCallback, useEffect, useRef, useState } from "react";
import {
  detectSpeechSupport,
  getSpeechRecognitionConstructor,
  speechErrorMessage,
  type SpeechRecognitionLike,
} from "./speech";

export type CaptureState = "idle" | "requesting" | "listening";

type UseSpeechCaptureOptions = {
  onFinalTranscript: (transcript: string) => void;
};

// Menyatukan tiga hal yang harus bergerak bersama: izin mikrofon, indikator
// level suara nyata (AnalyserNode), dan pengenalan suara. Level meter sengaja
// dipisah dari recognition supaya kegagalan salah satunya tidak mematikan
// yang lain — mis. meter gagal tetapi transkripsi tetap jalan.
export function useSpeechCapture({ onFinalTranscript }: UseSpeechCaptureOptions) {
  const [state, setState] = useState<CaptureState>("idle");
  const [level, setLevel] = useState(0);
  const [interim, setInterim] = useState("");
  const [error, setError] = useState<string | null>(null);

  const recognitionRef = useRef<SpeechRecognitionLike | null>(null);
  const streamRef = useRef<MediaStream | null>(null);
  const audioContextRef = useRef<AudioContext | null>(null);
  const frameRef = useRef<number | null>(null);
  const onFinalRef = useRef(onFinalTranscript);

  useEffect(() => {
    onFinalRef.current = onFinalTranscript;
  }, [onFinalTranscript]);

  const teardown = useCallback(() => {
    if (frameRef.current !== null) {
      cancelAnimationFrame(frameRef.current);
      frameRef.current = null;
    }
    if (audioContextRef.current) {
      void audioContextRef.current.close().catch(() => undefined);
      audioContextRef.current = null;
    }
    if (streamRef.current) {
      for (const track of streamRef.current.getTracks()) track.stop();
      streamRef.current = null;
    }
    if (recognitionRef.current) {
      recognitionRef.current.onresult = null;
      recognitionRef.current.onerror = null;
      recognitionRef.current.onend = null;
      recognitionRef.current.abort();
      recognitionRef.current = null;
    }
    setLevel(0);
  }, []);

  // Melepas mikrofon saat komponen dilepas; tanpa ini indikator perekaman
  // browser tetap menyala setelah user pindah halaman.
  useEffect(() => teardown, [teardown]);

  const startLevelMeter = useCallback((stream: MediaStream) => {
    try {
      const audioContext = new AudioContext();
      audioContextRef.current = audioContext;

      const source = audioContext.createMediaStreamSource(stream);
      const analyser = audioContext.createAnalyser();
      analyser.fftSize = 1024;
      source.connect(analyser);

      const buffer = new Uint8Array(analyser.fftSize);

      const tick = () => {
        analyser.getByteTimeDomainData(buffer);

        // RMS terhadap titik tengah 128; nilainya dinaikkan sedikit supaya
        // bicara normal terlihat jelas tanpa memperbesar derau ruangan.
        let sum = 0;
        for (const sample of buffer) {
          const centered = (sample - 128) / 128;
          sum += centered * centered;
        }
        const rms = Math.sqrt(sum / buffer.length);
        setLevel(Math.min(1, rms * 3));

        frameRef.current = requestAnimationFrame(tick);
      };

      frameRef.current = requestAnimationFrame(tick);
    } catch {
      // Indikator level bersifat tambahan: kegagalannya tidak menghentikan
      // perekaman, hanya membuat meter diam.
      setLevel(0);
    }
  }, []);

  const start = useCallback(async () => {
    const support = detectSpeechSupport();
    const Recognition = getSpeechRecognitionConstructor();

    if (!support.recognition || !Recognition) {
      setError("Browser ini belum mendukung pengenalan suara. Ketik jawabanmu sebagai gantinya.");
      return;
    }

    setError(null);
    setInterim("");
    setState("requesting");

    // Izin diminta di sini — saat user menekan rekam, bukan saat halaman
    // dibuka (SPK-2).
    if (support.media) {
      try {
        const stream = await navigator.mediaDevices.getUserMedia({ audio: true });
        streamRef.current = stream;
        startLevelMeter(stream);
      } catch {
        setState("idle");
        setError("Izin mikrofon ditolak. Aktifkan izin di pengaturan situs, atau ketik jawabanmu.");
        return;
      }
    }

    const recognition = new Recognition();
    recognition.lang = "ja-JP";
    recognition.continuous = false;
    recognition.interimResults = true;
    recognition.maxAlternatives = 1;

    recognition.onresult = (event) => {
      let finalText = "";
      let interimText = "";

      for (let index = event.resultIndex; index < event.results.length; index += 1) {
        const result = event.results[index];
        const alternative = result[0];
        if (!alternative) continue;
        if (result.isFinal) finalText += alternative.transcript;
        else interimText += alternative.transcript;
      }

      if (interimText) setInterim(interimText);
      if (finalText) {
        setInterim("");
        onFinalRef.current(finalText);
      }
    };

    recognition.onerror = (event) => {
      setError(speechErrorMessage(event.error));
    };

    recognition.onend = () => {
      setState("idle");
      teardown();
    };

    recognitionRef.current = recognition;

    try {
      recognition.start();
      setState("listening");
    } catch {
      setState("idle");
      teardown();
      setError("Perekaman tidak dapat dimulai. Ketik jawabanmu sebagai gantinya.");
    }
  }, [startLevelMeter, teardown]);

  const stop = useCallback(() => {
    recognitionRef.current?.stop();
    setState("idle");
  }, []);

  return { state, level, interim, error, start, stop, clearError: () => setError(null) };
}
