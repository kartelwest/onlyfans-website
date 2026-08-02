"use client";

import { ChangeEvent, useRef, useState } from "react";

import {
  AVATAR_ACCEPT_ATTRIBUTE,
  uploadModelAvatar,
  validateAvatarFile,
} from "@/lib/models/avatarUpload";

type ModelAvatarEditorProps = {
  modelId: string;
  modelName: string;
  profilePhotoUrl: string | null;
  onPhotoChange: (url: string) => void;
};

/**
 * The admin's photo control on the model page. Goes through the same
 * /api/models/avatar route, the same bucket and the same path convention as
 * the model's own editor in the Área da Modelo — she keeps that, this is an
 * addition, not a replacement.
 */
export default function ModelAvatarEditor({
  modelId,
  modelName,
  profilePhotoUrl,
  onPhotoChange,
}: ModelAvatarEditorProps) {
  const fileInputRef = useRef<HTMLInputElement>(null);

  const [preview, setPreview] = useState<string | null>(null);
  const [progress, setProgress] = useState(0);
  const [isUploading, setIsUploading] = useState(false);
  const [error, setError] = useState("");
  const [success, setSuccess] = useState("");

  async function handleFileChange(event: ChangeEvent<HTMLInputElement>) {
    const file = event.target.files?.[0];
    event.target.value = "";

    if (!file) {
      return;
    }

    setError("");
    setSuccess("");

    const validation = validateAvatarFile(file);

    if (!validation.ok) {
      setError(validation.message);
      return;
    }

    // Show her new photo immediately rather than after the round trip; a 5 MB
    // photo on a slow connection is a long time to stare at the old one.
    const localPreview = URL.createObjectURL(file);
    setPreview(localPreview);
    setProgress(0);
    setIsUploading(true);

    try {
      const url = await uploadModelAvatar({
        modelId,
        file,
        onProgress: setProgress,
      });

      onPhotoChange(url);
      setSuccess("Foto atualizada.");
    } catch (uploadError) {
      setPreview(null);
      setError(
        uploadError instanceof Error
          ? uploadError.message
          : "Não foi possível enviar a foto.",
      );
    } finally {
      setIsUploading(false);
      URL.revokeObjectURL(localPreview);
    }
  }

  const shownPhoto = preview ?? profilePhotoUrl;
  const initial = modelName.trim().charAt(0).toUpperCase() || "M";

  return (
    <div className="flex flex-col items-start gap-3">
      <div className="relative h-24 w-24 shrink-0 overflow-hidden rounded-full border-4 border-white/20 bg-black/30">
        {shownPhoto ? (
          // eslint-disable-next-line @next/next/no-img-element
          <img
            src={shownPhoto}
            alt={`Foto de ${modelName}`}
            className="h-full w-full object-cover"
          />
        ) : (
          <div className="flex h-full w-full items-center justify-center text-3xl font-bold text-white">
            {initial}
          </div>
        )}

        {isUploading && (
          <div className="absolute inset-0 flex items-center justify-center bg-black/60 text-xs font-bold text-white">
            {progress}%
          </div>
        )}
      </div>

      <button
        type="button"
        onClick={() => fileInputRef.current?.click()}
        disabled={isUploading}
        className="rounded-lg border border-pink-400/50 bg-pink-400/10 px-3 py-2 text-xs font-semibold text-pink-200 transition hover:bg-pink-400 hover:text-black disabled:cursor-not-allowed disabled:opacity-50"
      >
        {isUploading
          ? `Enviando... ${progress}%`
          : profilePhotoUrl
            ? "Trocar foto"
            : "Carregar foto"}
      </button>

      {isUploading && (
        <div
          className="h-1 w-24 overflow-hidden rounded-full bg-white/15"
          role="progressbar"
          aria-valuenow={progress}
          aria-valuemin={0}
          aria-valuemax={100}
        >
          <div
            className="h-full bg-pink-400 transition-all"
            style={{ width: `${progress}%` }}
          />
        </div>
      )}

      <input
        ref={fileInputRef}
        type="file"
        accept={AVATAR_ACCEPT_ATTRIBUTE}
        onChange={(event) => void handleFileChange(event)}
        className="hidden"
      />

      {error && (
        <p className="max-w-[12rem] text-xs font-semibold leading-5 text-red-300">
          {error}
        </p>
      )}

      {success && !error && (
        <p className="text-xs font-semibold text-emerald-300">{success}</p>
      )}
    </div>
  );
}
