"use client";

import { useRef, useState } from "react";
import { Camera, LoaderCircle, Trash2 } from "lucide-react";
import { Avatar, AvatarFallback, AvatarImage } from "@/components/ui/avatar";
import { getAvatarUploadSignatureAction } from "../actions";

const MAX_FILE_SIZE_BYTES = 3 * 1024 * 1024;
const ALLOWED_TYPES = new Set(["image/jpeg", "image/png", "image/webp"]);

async function uploadAvatar(file: File) {
  const {
    signature,
    timestamp,
    apiKey,
    cloudName,
    publicId,
    allowedFormats,
    transformation,
    overwrite,
  } =
    await getAvatarUploadSignatureAction();
  const formData = new FormData();
  formData.append("file", file);
  formData.append("api_key", apiKey);
  formData.append("timestamp", String(timestamp));
  formData.append("signature", signature);
  formData.append("public_id", publicId);
  formData.append("allowed_formats", allowedFormats);
  formData.append("transformation", transformation);
  formData.append("overwrite", String(overwrite));

  const response = await fetch(`https://api.cloudinary.com/v1_1/${cloudName}/image/upload`, {
    method: "POST",
    body: formData,
  });

  if (!response.ok) throw new Error("Upload avatar gagal.");

  const data: unknown = await response.json();
  if (
    typeof data !== "object" ||
    data === null ||
    !("secure_url" in data) ||
    !("public_id" in data) ||
    typeof data.secure_url !== "string" ||
    typeof data.public_id !== "string" ||
    data.public_id !== publicId ||
    !data.secure_url.startsWith("https://res.cloudinary.com/")
  ) {
    throw new Error("Respons upload avatar tidak valid.");
  }

  return { url: data.secure_url, publicId: data.public_id };
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

    if (file.size > MAX_FILE_SIZE_BYTES) {
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
          Gambar disimpan di Cloudinary project. Format JPG, PNG, atau WebP hingga 3MB.
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
          accept="image/jpeg,image/png,image/webp"
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
