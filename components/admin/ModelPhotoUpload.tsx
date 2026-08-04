"use client";

import { useTranslations } from "next-intl";

import { ChangeEvent, useRef, useState } from "react";

type ModelPhotoUploadProps = {
  photo: string;
  modelName: string;
  isEditing: boolean;
  onPhotoChange: (photo: string) => void;
};

const MAX_FILE_SIZE = 10 * 1024 * 1024;

export default function ModelPhotoUpload({
  photo,
  modelName,
  isEditing,
  onPhotoChange,
}: ModelPhotoUploadProps) {
  const t = useTranslations("admin.photoUpload");
  const tAvatar = useTranslations("admin.avatar");

  const fileInputRef = useRef<HTMLInputElement>(null);

  const [error, setError] = useState("");
  const [isProcessing, setIsProcessing] =
    useState(false);

  function openFileSelector() {
    fileInputRef.current?.click();
  }

  async function handleFileChange(
    event: ChangeEvent<HTMLInputElement>
  ) {
    const file = event.target.files?.[0];

    event.target.value = "";

    if (!file) {
      return;
    }

    setError("");

    if (!file.type.startsWith("image/")) {
      setError(
        t("invalidType")
      );
      return;
    }

    if (file.size > MAX_FILE_SIZE) {
      setError(
        t("tooLarge")
      );
      return;
    }

    setIsProcessing(true);

    try {
      const compressedPhoto =
        await compressProfilePhoto(file);

      onPhotoChange(compressedPhoto);
    } catch (processingError) {
      console.error(
        "Failed to process the photo:",
        processingError
      );

      setError(
        t("processFailed")
      );
    } finally {
      setIsProcessing(false);
    }
  }

  function removePhoto() {
    setError("");
    onPhotoChange("");
  }

  const initial =
    modelName.trim().charAt(0).toUpperCase() || "M";

  return (
    <div className="rounded-2xl border border-white/10 bg-black/20 p-5 sm:col-span-2 lg:col-span-3">
      <div className="flex flex-col gap-5 sm:flex-row sm:items-center">
        <div className="relative h-32 w-32 flex-shrink-0 overflow-hidden rounded-full border-4 border-pink-400/30 bg-[#19191e] shadow-lg shadow-pink-950/20">
          {photo ? (
            <img
              src={photo}
              alt={`Foto de ${modelName}`}
              className="h-full w-full object-cover"
            />
          ) : (
            <div className="flex h-full w-full items-center justify-center text-4xl font-bold text-pink-300">
              {initial}
            </div>
          )}
        </div>

        <div className="flex-1">
          <p className="text-xs font-semibold uppercase tracking-[0.2em] text-zinc-500">
            {t("eyebrow")}
          </p>

          <h3 className="mt-2 text-lg font-bold text-white">
            {modelName || t("model")}
          </h3>

          <p className="mt-2 max-w-xl text-sm leading-6 text-zinc-400">
            {t("hint")}
          </p>

          {isEditing && (
            <div className="mt-4 flex flex-wrap gap-3">
              <button
                type="button"
                onClick={openFileSelector}
                disabled={isProcessing}
                className="rounded-lg border border-pink-400/50 bg-pink-400/10 px-4 py-2 text-sm font-semibold text-pink-200 transition hover:bg-pink-400 hover:text-black disabled:cursor-not-allowed disabled:opacity-50"
              >
                {isProcessing
                  ? t("processing")
                  : photo
                    ? tAvatar("replace")
                    : tAvatar("upload")}
              </button>

              {photo && (
                <button
                  type="button"
                  onClick={removePhoto}
                  disabled={isProcessing}
                  className="rounded-lg border border-red-500/40 bg-red-500/10 px-4 py-2 text-sm font-semibold text-red-300 transition hover:bg-red-500 hover:text-white disabled:cursor-not-allowed disabled:opacity-50"
                >
                  {t("remove")}
                </button>
              )}
            </div>
          )}

          <input
            ref={fileInputRef}
            type="file"
            accept="image/jpeg,image/png,image/webp"
            onChange={handleFileChange}
            className="hidden"
          />

          {error && (
            <p className="mt-3 text-sm font-semibold text-red-400">
              {error}
            </p>
          )}

          {!isEditing && !photo && (
            <p className="mt-3 text-sm text-zinc-500">
              {t("none")}
            </p>
          )}
        </div>
      </div>
    </div>
  );
}

function compressProfilePhoto(
  file: File
): Promise<string> {
  return new Promise((resolve, reject) => {
    const reader = new FileReader();

    reader.onerror = () => {
      reject(
        new Error("Could not read the selected file.")
      );
    };

    reader.onload = () => {
      if (typeof reader.result !== "string") {
        reject(
          new Error(
            "The file did not decode to a valid image."
          )
        );
        return;
      }

      const image = new Image();

      image.onerror = () => {
        reject(
          new Error(
            "The image could not be loaded."
          )
        );
      };

      image.onload = () => {
        const outputSize = 600;

        const canvas =
          document.createElement("canvas");

        canvas.width = outputSize;
        canvas.height = outputSize;

        const context = canvas.getContext("2d");

        if (!context) {
          reject(
            new Error(
              "The image could not be prepared."
            )
          );
          return;
        }

        const sourceSize = Math.min(
          image.width,
          image.height
        );

        const sourceX =
          (image.width - sourceSize) / 2;

        const sourceY =
          (image.height - sourceSize) / 2;

        context.drawImage(
          image,
          sourceX,
          sourceY,
          sourceSize,
          sourceSize,
          0,
          0,
          outputSize,
          outputSize
        );

        const compressedImage = canvas.toDataURL(
          "image/jpeg",
          0.78
        );

        resolve(compressedImage);
      };

      image.src = reader.result;
    };

    reader.readAsDataURL(file);
  });
}