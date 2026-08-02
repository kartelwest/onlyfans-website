/**
 * Profile photo upload — shared by the model's own editor in the Área da
 * Modelo and the admin editor on the model page.
 *
 * There is exactly ONE upload path in this app: POST /api/models/avatar, which
 * writes to the public `model-avatars` bucket at `${model_id}/${uuid}.${ext}`
 * with the service-role key and then sets models.profile_photo_url. Both
 * editors go through here so the limits, the messages and the bucket can never
 * drift apart. Do not add a second bucket or a direct-from-browser upload.
 *
 * The limits below MUST stay in step with the server checks in
 * app/api/models/avatar/route.ts — the server is the one that enforces them;
 * these exist so a model on a phone finds out before spending her data
 * allowance on an upload that will be rejected.
 */

export const MAX_AVATAR_BYTES = 5 * 1024 * 1024;

export const ALLOWED_AVATAR_MIME_TYPES = [
  "image/jpeg",
  "image/png",
  "image/webp",
] as const;

/** The `accept` attribute for every avatar file input. */
export const AVATAR_ACCEPT_ATTRIBUTE =
  ALLOWED_AVATAR_MIME_TYPES.join(",");

export type AvatarValidationResult =
  | { ok: true }
  | { ok: false; message: string };

export function validateAvatarFile(file: File): AvatarValidationResult {
  if (
    !ALLOWED_AVATAR_MIME_TYPES.includes(
      file.type as (typeof ALLOWED_AVATAR_MIME_TYPES)[number],
    )
  ) {
    return {
      ok: false,
      message: "Tipo de arquivo não permitido. Use JPG, PNG ou WebP.",
    };
  }

  if (file.size > MAX_AVATAR_BYTES) {
    return {
      ok: false,
      message: "Arquivo muito grande. O máximo é 5 MB.",
    };
  }

  return { ok: true };
}

type UploadArgs = {
  modelId: string;
  file: File;
  /** 0-100. Called only while the bytes are still going up. */
  onProgress?: (percentage: number) => void;
};

/**
 * Uploads the photo and resolves with the new public URL.
 *
 * XMLHttpRequest rather than fetch: fetch cannot report upload progress, and
 * the models are on phones where a 5 MB photo over mobile data is slow enough
 * that a button stuck on "Enviando..." reads as broken.
 */
export function uploadModelAvatar({
  modelId,
  file,
  onProgress,
}: UploadArgs): Promise<string> {
  return new Promise((resolve, reject) => {
    const formData = new FormData();
    formData.append("modelId", modelId);
    formData.append("file", file);

    const request = new XMLHttpRequest();

    request.open("POST", "/api/models/avatar");

    request.upload.onprogress = (event) => {
      if (!event.lengthComputable || !onProgress) {
        return;
      }

      onProgress(Math.round((event.loaded / event.total) * 100));
    };

    request.onerror = () => {
      reject(new Error("Não foi possível enviar a foto."));
    };

    request.onload = () => {
      let payload: { profilePhotoUrl?: string; error?: string } = {};

      try {
        payload = JSON.parse(request.responseText);
      } catch {
        reject(new Error("Não foi possível enviar a foto."));
        return;
      }

      if (request.status < 200 || request.status >= 300) {
        reject(
          new Error(payload.error || "Não foi possível enviar a foto."),
        );
        return;
      }

      if (!payload.profilePhotoUrl) {
        reject(new Error("Não foi possível enviar a foto."));
        return;
      }

      resolve(payload.profilePhotoUrl);
    };

    request.send(formData);
  });
}
