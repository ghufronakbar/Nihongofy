"use client";

import { useCallback, useEffect, useRef, useState } from "react";
import {
  getMoraePerSecond,
  moraDurationMs,
  recordUtteranceTiming,
  textToMouthShapes,
  type MouthShape,
} from "./mora-lipsync";

/**
 * Menjalankan urutan bentuk mulut selama karakter berbicara.
 *
 * Dipacu `requestAnimationFrame` dan dihitung dari waktu berlalu, bukan
 * `setInterval` yang menumpuk — jadi kalau tab sempat tidak aktif, posisinya
 * tetap benar saat kembali alih-alih tertinggal.
 *
 * Urutannya dimajukan sedikit oleh LEAD_MS. Antara `onstart` berbunyi dan
 * bentuk mulut benar-benar tampil di layar ada jeda tetap: satu putaran render
 * React ditambah satu frame paint. Nilainya kecil dan konstan, jadi dikompensasi
 * di sini alih-alih dibebankan ke kalibrasi laju — kalibrasi hanya boleh
 * mengurus kecepatan, bukan menutupi jeda awal.
 *
 * `finish()` dipanggil saat ucapan selesai normal dan memakai durasi
 * sebenarnya untuk mengalibrasi laju bicara perangkat, sehingga ucapan
 * berikutnya lebih pas. `cancel()` dipakai saat perekaman dibatalkan atau
 * gagal, dan sengaja tidak ikut mengalibrasi.
 */
const LEAD_MS = 55;

export function useLipSync(rate: number) {
  const [mouth, setMouth] = useState<MouthShape>("closed");
  const frameRef = useRef<number | null>(null);
  const shapesRef = useRef<MouthShape[]>([]);
  const startedAtRef = useRef(0);
  const moraCountRef = useRef(0);

  const cancel = useCallback(() => {
    if (frameRef.current !== null) {
      cancelAnimationFrame(frameRef.current);
      frameRef.current = null;
    }
    shapesRef.current = [];
    moraCountRef.current = 0;
    setMouth("closed");
  }, []);

  useEffect(() => cancel, [cancel]);

  const start = useCallback(
    (markup: string) => {
      const shapes = textToMouthShapes(markup);
      if (shapes.length === 0) {
        setMouth("closed");
        return;
      }

      if (frameRef.current !== null) cancelAnimationFrame(frameRef.current);

      shapesRef.current = shapes;
      moraCountRef.current = shapes.length;
      startedAtRef.current = performance.now();
      const perMora = moraDurationMs(rate, getMoraePerSecond());

      const tick = () => {
        const elapsed = performance.now() - startedAtRef.current + LEAD_MS;
        const index = Math.floor(elapsed / perMora);

        if (index >= shapesRef.current.length) {
          // Teks habis lebih dulu daripada suaranya. Mulut ditahan setengah
          // terbuka alih-alih langsung tertutup rapat, supaya karakter tidak
          // terlihat berhenti bicara padahal suaranya masih berjalan; posisi
          // sebenarnya dikoreksi oleh kalibrasi pada ucapan berikutnya.
          frameRef.current = null;
          setMouth("u");
          return;
        }

        setMouth(shapesRef.current[index] ?? "closed");
        frameRef.current = requestAnimationFrame(tick);
      };

      setMouth(shapes[0] ?? "closed");
      frameRef.current = requestAnimationFrame(tick);
    },
    [rate],
  );

  const finish = useCallback(() => {
    const elapsed = performance.now() - startedAtRef.current;
    const moraCount = moraCountRef.current;

    if (frameRef.current !== null) {
      cancelAnimationFrame(frameRef.current);
      frameRef.current = null;
    }
    shapesRef.current = [];
    moraCountRef.current = 0;
    setMouth("closed");

    // Durasi ucapan yang benar-benar terjadi adalah satu-satunya sinyal timing
    // yang diberikan Web Speech Synthesis. Dipakai untuk ucapan berikutnya.
    if (moraCount > 0) recordUtteranceTiming(moraCount, elapsed, rate);
  }, [rate]);

  return { mouth, start, finish, cancel };
}
