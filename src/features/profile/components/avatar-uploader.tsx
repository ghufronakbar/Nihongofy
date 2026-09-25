"use client";

import { useRef, useState } from "react";
import { Camera, LoaderCircle, Trash2 } from "lucide-react";
import { Avatar, AvatarFallback, AvatarImage } from "@/components/ui/avatar";
import {
  AVATAR_DIMENSION,
  AVATAR_MAX_FILE_SIZE_BYTES,
  AVATAR_SOURCE_ACCEPT,
  AVATAR_SOURCE_CONTENT_TYPES,
  AVATAR_WEBP_QUALITY,
} from "@/constants/storage";
import { createAvatarUploadAction } from "../actions";

const ALLOWED_TYPES = new Set<string>(AVATAR_SOURCE_CONTENT_TYPES);

/**
 * R2 hanya menyimpan byte apa adanya — tidak ada transformasi seperti
 * `c_fill,g_auto` di Cloudinary. Jadi crop tengah + resize ke 512x512 WebP
 * dilakukan di browser sebelum upload, dan server memverifikasi ulang dimensi
 * hasilnya dari header file di R2.
 */
async function toSquareAvatarWebp(file: File): Promise<Blob> {
  const bitmap = await createImageBitmap(file);
  try {
    const side = Math.min(bitmap.width, bitmap.height);
    const canvas = document.createElement("canvas");
    canvas.width = AVATAR_DIMENSION;
    canvas.height = AVATAR_DIMENSION;

    const context = canvas.getContext("2d");
    if (!context) throw new Error("Canvas tidak tersedia.");
    context.drawImage(
      bitmap,
      (bitmap.width - side) / 2,
      (bitmap.height - side) / 2,
      side,
      side,
      0,
      0,
      AVATAR_DIMENSION,
      AVATAR_DIMENSION,
    );

    const blob = await new Promise<Blob | null>((resolve) => {
      canvas.toBlob(resolve, "image/webp", AVATAR_WEBP_QUALITY);
    });
    if (!blob) throw new Error("Gagal memproses gambar.");
    return blob;
  } finally {
    bitmap.close();
  }
}

async function uploadAvatar(file: File) {
  const image = await toSquareAvatarWebp(file);
  if (image.size > AVATAR_MAX_FILE_SIZE_BYTES) {
    throw new Error("Hasil kompresi avatar masih terlalu besar.");
  }

  const { uploadUrl, key, url, contentType } = await createAvatarUploadAction({
    byteLength: image.size,
  });

  // Upload langsung ke R2. Content-Type wajib sama persis dengan yang
  // ditandatangani server, kalau tidak R2 menolak signature-nya.
  const response = await fetch(uploadUrl, {
    method: "PUT",
    headers: { "Content-Type": contentType },
    body: image,
  });
  if (!response.ok) throw new Error("Upload avatar gagal.");

  return { url, publicId: key };
}

export function AvatarUploader({
  value,
  displayName,
  onChange,
}: {
  value: { url: string; publicId: string | null } | null;
  displayName: string;
  onChange: (avatar: { url: string; publicId: string } | null) => void;
}) {
  const inputRef = useRef<HTMLInputElement>(null);
  const [isUploading, setIsUploading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const initials = displayName
    .split(/\s+/)
    .filter(Boolean)
    .slice(0, 2)
    .map((part) => part[0]?.toUpperCase())
    .join("") || "?";

  async function handleFile(file: File | undefined) {
    if (!file) return;
    setError(null);

    if (!ALLOWED_TYPES.has(file.type)) {
      setError("Gunakan gambar JPG, PNG, atau WebP.");
      return;
    }

    if (file.size > AVATAR_MAX_FILE_SIZE_BYTES) {
      setError("Ukuran avatar maksimal 3MB.");
      return;
    }

    setIsUploading(true);
    try {
      onChange(await uploadAvatar(file));
    } catch {
      setError("Upload avatar gagal. Coba lagi.");
    } finally {
      setIsUploading(false);
    }
  }

  return (
    <div className="grid gap-4 sm:grid-cols-[auto_1fr] sm:items-center">
      <Avatar className="size-28 rounded-lg border-[3px] border-black bg-neo-blue shadow-neo">
        {value ? (
          <AvatarImage src={value.url} alt={`Avatar ${displayName}`} className="rounded-md" />
        ) : null}
        <AvatarFallback className="rounded-md bg-neo-blue text-3xl font-black text-black">
          {initials}
        </AvatarFallback>
      </Avatar>

      <div>
        <p className="font-black">Foto profil</p>
        <p className="mt-1 max-w-md text-sm text-muted-foreground">
          Gambar dipotong otomatis menjadi {AVATAR_DIMENSION}&times;{AVATAR_DIMENSION}. Format JPG,
          PNG, atau WebP hingga 3MB.
        </p>
        <div className="mt-4 flex flex-wrap gap-2">
          <button
            type="button"
            disabled={isUploading}
            onClick={() => inputRef.current?.click()}
            className="neo-button bg-neo-blue"
          >
            {isUploading ? (
              <LoaderCircle className="size-4 animate-spin" aria-hidden="true" />
            ) : (
              <Camera className="size-4" aria-hidden="true" />
            )}
            {isUploading ? "Mengunggah..." : value ? "Ganti foto" : "Unggah foto"}
          </button>
          {value ? (
            <button
              type="button"
              disabled={isUploading}
              onClick={() => onChange(null)}
              className="neo-button bg-white"
            >
              <Trash2 className="size-4" aria-hidden="true" /> Hapus
            </button>
          ) : null}
        </div>
        {error ? <p role="alert" className="mt-3 text-sm font-bold text-destructive">{error}</p> : null}
        <input
          ref={inputRef}
          type="file"
          accept={AVATAR_SOURCE_ACCEPT}
          className="hidden"
          onChange={(event) => {
            void handleFile(event.target.files?.[0]);
            event.target.value = "";
          }}
        />
      </div>
    </div>
  );
}
