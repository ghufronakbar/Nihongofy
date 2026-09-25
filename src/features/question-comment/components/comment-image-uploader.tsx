"use client";

import { useRef, useState } from "react";
import { ImagePlus, Loader2, X } from "lucide-react";
import {
  COMMENT_IMAGE_ACCEPT,
  COMMENT_IMAGE_MAX_COUNT,
  COMMENT_IMAGE_MAX_FILE_SIZE_BYTES,
  isCommentImageContentType,
} from "@/constants/storage";
import { createCommentImageUploadAction } from "../actions";

const MAX_IMAGES = COMMENT_IMAGE_MAX_COUNT;
const MAX_FILE_SIZE_BYTES = COMMENT_IMAGE_MAX_FILE_SIZE_BYTES;

async function uploadToR2(file: File): Promise<string> {
  if (!isCommentImageContentType(file.type)) {
    throw new Error("Tipe gambar tidak didukung.");
  }

  const { uploadUrl, url, contentType } = await createCommentImageUploadAction({
    contentType: file.type,
    byteLength: file.size,
  });

  // Upload langsung dari browser ke R2 — file tidak pernah lewat server kita.
  // Content-Type harus sama persis dengan yang ditandatangani server.
  const response = await fetch(uploadUrl, {
    method: "PUT",
    headers: { "Content-Type": contentType },
    body: file,
  });

  if (!response.ok) {
    throw new Error("Upload gambar gagal.");
  }

  return url;
}

export function CommentImageUploader({
  value,
  onChange,
}: {
  value: string[];
  onChange: (urls: string[]) => void;
}) {
  const inputRef = useRef<HTMLInputElement>(null);
  const [isUploading, setIsUploading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  async function handleFiles(files: FileList | null) {
    if (!files || files.length === 0) return;
    setError(null);

    const remainingSlots = MAX_IMAGES - value.length;
    if (remainingSlots <= 0) {
      setError(`Maksimal ${MAX_IMAGES} gambar.`);
      return;
    }

    const selected = Array.from(files).slice(0, remainingSlots);
    setIsUploading(true);

    // `value` adalah snapshot dari render ini, jadi hasil upload diakumulasi ke
    // daftar lokal. Tanpa ini, upload kedua dan seterusnya menimpa yang sebelumnya
    // dan hanya URL terakhir yang tersisa.
    let uploaded = value;
    for (const file of selected) {
      if (!isCommentImageContentType(file.type)) {
        setError("Gunakan gambar JPG, PNG, WebP, atau GIF.");
        continue;
      }
      if (file.size > MAX_FILE_SIZE_BYTES) {
        setError("Ukuran gambar maksimal 5MB.");
        continue;
      }

      try {
        uploaded = [...uploaded, await uploadToR2(file)];
        onChange(uploaded);
      } catch {
        setError("Upload gambar gagal, coba lagi.");
      }
    }

    setIsUploading(false);
  }

  function removeImage(url: string) {
    onChange(value.filter((existing) => existing !== url));
  }

  return (
    <div className="flex flex-col gap-2">
      <div className="flex flex-wrap gap-2">
        {value.map((url) => (
          <div key={url} className="group relative size-16 overflow-hidden rounded-md border">
            {/* eslint-disable-next-line @next/next/no-img-element */}
            <img src={url} alt="" className="size-full object-cover" />
            <button
              type="button"
              onClick={() => removeImage(url)}
              className="absolute top-0.5 right-0.5 rounded-full bg-background/80 p-0.5 opacity-0 transition-opacity group-hover:opacity-100"
              aria-label="Hapus gambar"
            >
              <X className="size-3" />
            </button>
          </div>
        ))}
        {value.length < MAX_IMAGES && (
          <button
            type="button"
            onClick={() => inputRef.current?.click()}
            disabled={isUploading}
            className="flex size-16 items-center justify-center rounded-md border border-dashed text-muted-foreground hover:bg-muted disabled:opacity-50"
            aria-label="Tambah gambar"
          >
            {isUploading ? (
              <Loader2 className="size-4 animate-spin" />
            ) : (
              <ImagePlus className="size-4" />
            )}
          </button>
        )}
      </div>
      {error && <p className="text-xs text-destructive">{error}</p>}
      <input
        ref={inputRef}
        type="file"
        accept={COMMENT_IMAGE_ACCEPT}
        multiple
        className="hidden"
        onChange={(event) => {
          void handleFiles(event.target.files);
          event.target.value = "";
        }}
      />
    </div>
  );
}
