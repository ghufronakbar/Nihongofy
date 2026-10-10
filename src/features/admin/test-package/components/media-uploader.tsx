"use client";

import { useId, useRef, useState } from "react";
import { FileAudio, ImagePlus, Loader2, RefreshCw, Trash2, Upload } from "lucide-react";
import {
  isTestPackageAudioContentType,
  isTestPackageImageContentType,
  TEST_PACKAGE_AUDIO_ACCEPT,
  TEST_PACKAGE_AUDIO_MAX_FILE_SIZE_BYTES,
  TEST_PACKAGE_IMAGE_ACCEPT,
  TEST_PACKAGE_IMAGE_MAX_FILE_SIZE_BYTES,
} from "@/constants/storage";
import { createTestPackageMediaUploadAction } from "../media-actions";

type MediaKind = "image" | "audio";

function fileSizeLabel(bytes: number) {
  return `${Math.round(bytes / 1024 / 1024)} MB`;
}

export function TestPackageMediaUploader({
  testPackageId,
  packageSlug,
  kind,
  label,
  value,
  onChange,
  onUploadingChange,
  compact = false,
}: {
  testPackageId: number;
  packageSlug: string;
  kind: MediaKind;
  label: string;
  value: string | null;
  onChange: (url: string | null) => void;
  onUploadingChange?: (uploading: boolean) => void;
  compact?: boolean;
}) {
  const inputId = useId();
  const inputRef = useRef<HTMLInputElement>(null);
  const [isUploading, setIsUploading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const isImage = kind === "image";
  const maxBytes = isImage
    ? TEST_PACKAGE_IMAGE_MAX_FILE_SIZE_BYTES
    : TEST_PACKAGE_AUDIO_MAX_FILE_SIZE_BYTES;

  async function handleFile(file: File | undefined) {
    if (!file) return;
    setError(null);

    const validType = isImage
      ? isTestPackageImageContentType(file.type)
      : isTestPackageAudioContentType(file.type);
    if (!validType) {
      setError(isImage ? "Gunakan JPG, PNG, WebP, atau GIF." : "Gunakan MP3, M4A, WAV, OGG, atau WebM.");
      return;
    }
    if (file.size > maxBytes) {
      setError(`Ukuran maksimal ${fileSizeLabel(maxBytes)}.`);
      return;
    }

    setIsUploading(true);
    onUploadingChange?.(true);
    try {
      const signed = await createTestPackageMediaUploadAction({
        testPackageId,
        mediaType: isImage ? "images" : "audio",
        contentType: file.type,
        byteLength: file.size,
        originalFileName: file.name,
      });
      if (!signed.ok) {
        setError(signed.message);
        return;
      }

      const response = await fetch(signed.uploadUrl, {
        method: "PUT",
        headers: { "Content-Type": signed.contentType },
        body: file,
      });
      if (!response.ok) throw new Error("R2 menolak upload.");
      onChange(signed.url);
    } catch {
      setError("Upload gagal. Periksa koneksi lalu coba lagi.");
    } finally {
      setIsUploading(false);
      onUploadingChange?.(false);
    }
  }

  return (
    <div className="flex flex-col gap-2">
      <div className="flex items-center justify-between gap-3">
        <label htmlFor={inputId} className="text-sm font-medium leading-none">
          {label}
        </label>
        <span className="font-mono text-[10px] font-bold text-foreground/45">
          {packageSlug}/{isImage ? "images" : "audio"}/
        </span>
      </div>

      {value ? (
        <div className="flex flex-col gap-3 border-2 border-neo-ink bg-neo-paper p-3">
          {isImage ? (
            // eslint-disable-next-line @next/next/no-img-element
            <img
              src={value}
              alt={`Pratinjau ${label.toLowerCase()}`}
              className={compact ? "max-h-36 w-auto object-contain" : "max-h-72 w-auto object-contain"}
            />
          ) : (
            <audio controls preload="metadata" src={value} className="w-full">
              <track kind="captions" />
            </audio>
          )}
          <div className="flex flex-wrap items-center gap-2">
            <button
              type="button"
              onClick={() => inputRef.current?.click()}
              disabled={isUploading}
              className="neo-button bg-white text-[11px] font-extrabold text-black"
            >
              {isUploading ? <Loader2 className="size-3.5 animate-spin" /> : <RefreshCw className="size-3.5" />}
              Ganti
            </button>
            <button
              type="button"
              onClick={() => onChange(null)}
              disabled={isUploading}
              className="neo-button bg-white text-[11px] font-extrabold text-black"
            >
              <Trash2 className="size-3.5" />
              Hapus
            </button>
          </div>
        </div>
      ) : (
        <button
          type="button"
          onClick={() => inputRef.current?.click()}
          disabled={isUploading}
          className={`flex items-center justify-center gap-3 border-2 border-dashed border-neo-ink/35 bg-neo-paper px-4 text-left hover:border-neo-blue hover:bg-white disabled:opacity-60 ${compact ? "min-h-16" : "min-h-24"}`}
        >
          {isUploading ? (
            <Loader2 className="size-5 shrink-0 animate-spin text-neo-blue" />
          ) : isImage ? (
            <ImagePlus className="size-5 shrink-0 text-neo-blue" />
          ) : (
            <FileAudio className="size-5 shrink-0 text-neo-blue" />
          )}
          <span>
            <span className="block text-sm font-extrabold">
              {isUploading ? "Mengunggah ke R2..." : `Pilih ${isImage ? "gambar" : "audio"}`}
            </span>
            <span className="mt-0.5 block text-[11px] font-semibold text-foreground/55">
              Maksimal {fileSizeLabel(maxBytes)}. File langsung masuk ke folder paket ini.
            </span>
          </span>
          {!isUploading && <Upload className="ml-auto size-4 shrink-0" />}
        </button>
      )}

      {error && <p className="text-xs font-bold text-destructive">{error}</p>}
      <p className="text-[10px] font-semibold text-foreground/50">
        Perubahan media dipakai setelah form disimpan.
      </p>
      <input
        ref={inputRef}
        id={inputId}
        type="file"
        accept={isImage ? TEST_PACKAGE_IMAGE_ACCEPT : TEST_PACKAGE_AUDIO_ACCEPT}
        className="hidden"
        onChange={(event) => {
          void handleFile(event.target.files?.[0]);
          event.target.value = "";
        }}
      />
    </div>
  );
}
