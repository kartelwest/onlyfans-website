"use client";

import { ChangeEvent, useRef, useState } from "react";

type ModelPhotoUploadProps = {
  photo: string | null;
  modelName: string;
  modelId: string;
  isEditing: boolean;
  onPhotoChange: (photo: string | null) => void;
};

const MAX_FILE_SIZE = 10 * 1024 * 1024;

export default function ModelPhotoUpload({
  photo,
  modelName,
  modelId,
  isEditing,
  onPhotoChange,
}: ModelPhotoUploadProps) {
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
        "Selecione um arquivo de imagem válido."
      );
      return;
    }

    if (file.size > MAX_FILE_SIZE) {
      setError(
        "A imagem deve ter no máximo 10 MB."
      );
      return;
    }

    setIsProcessing(true);

    try {
      const resizedFile =
        await compressProfilePhoto(file);

      const formData = new FormData();
      formData.append("file", resizedFile);
      formData.append("modelId", modelId);

      const response = await fetch(
        "/api/models/photo",
        {
          method: "POST",
          body: formData,
        }
      );

      const data = (await response.json()) as {
        success?: boolean;
        photoUrl?: string;
        error?: string;
      };

      if (!response.ok || !data.success) {
        throw new Error(
          data.error ?? "Erro ao fazer upload."
        );
      }

      onPhotoChange(data.photoUrl ?? null);
    } catch (processingError) {
      console.error(
        "Erro ao processar a foto:",
        processingError
      );

      setError(
        processingError instanceof Error
          ? processingError.message
          : "Não foi possível processar esta imagem."
      );
    } finally {
      setIsProcessing(false);
    }
  }

  async function removePhoto() {
    setError("");
    setIsProcessing(true);

    try {
      const response = await fetch(
        `/api/models/photo?modelId=${modelId}`,
        { method: "DELETE" }
      );

      const data = (await response.json()) as {
        success?: boolean;
        error?: string;
      };

      if (!response.ok || !data.success) {
        throw new Error(
          data.error ?? "Erro ao remover foto."
        );
      }

      onPhotoChange(null);
    } catch (removeError) {
      console.error(
        "Erro ao remover foto:",
        removeError
      );
      setError(
        removeError instanceof Error
          ? removeError.message
          : "Não foi possível remover a foto."
      );
    } finally {
      setIsProcessing(false);
    }
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
            Foto da modelo
          </p>

          <h3 className="mt-2 text-lg font-bold text-white">
            {modelName || "Modelo"}
          </h3>

          <p className="mt-2 max-w-xl text-sm leading-6 text-zinc-400">
            Selecione uma foto do computador. A imagem
            será recortada, reduzida e enviada para o
            armazenamento da plataforma.
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
                  ? "Processando..."
                  : photo
                    ? "Trocar foto"
                    : "Carregar foto"}
              </button>

              {photo && (
                <button
                  type="button"
                  onClick={removePhoto}
                  disabled={isProcessing}
                  className="rounded-lg border border-red-500/40 bg-red-500/10 px-4 py-2 text-sm font-semibold text-red-300 transition hover:bg-red-500 hover:text-white disabled:cursor-not-allowed disabled:opacity-50"
                >
                  {isProcessing ? "Removendo..." : "Remover foto"}
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
              Nenhuma foto cadastrada.
            </p>
          )}

          {isProcessing && (
            <p className="mt-3 text-sm text-pink-300">
              Processando...
            </p>
          )}
        </div>
      </div>
    </div>
  );
}

function compressProfilePhoto(
  file: File
): Promise<File> {
  return new Promise((resolve, reject) => {
    const reader = new FileReader();

    reader.onerror = () => {
      reject(
        new Error("Não foi possível ler o arquivo.")
      );
    };

    reader.onload = () => {
      if (typeof reader.result !== "string") {
        reject(
          new Error(
            "O arquivo não gerou uma imagem válida."
          )
        );
        return;
      }

      const image = new Image();

      image.onerror = () => {
        reject(
          new Error(
            "Não foi possível carregar a imagem."
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
              "Não foi possível preparar a imagem."
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

        canvas.toBlob(
          (blob) => {
            if (!blob) {
              reject(
                new Error(
                  "Não foi possível processar a imagem."
                )
              );
              return;
            }

            const resizedFile = new File(
              [blob],
              file.name,
              { type: "image/jpeg" }
            );

            resolve(resizedFile);
          },
          "image/jpeg",
          0.78
        );
      };

      image.src = reader.result;
    };

    reader.readAsDataURL(file);
  });
}