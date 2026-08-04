/**
 * Google Drive folder references, as an admin types them.
 *
 * Three shapes are accepted, because all three are what people actually paste:
 * a full folder URL, an `open?id=` URL, and a bare folder ID. Anything else is
 * not a folder we can send a model to, so it is refused at the point of entry
 * rather than saved and discovered later by a model staring at a dead link.
 *
 * Kept free of `server-only` and of the googleapis import on purpose: the same
 * rule has to run in the browser (so the admin is told immediately) and on the
 * server (so the rule is actually enforced). lib/googleDrive.ts re-exports
 * `extractDriveFolderId` from here, so the upload path keeps its single import.
 */

export function extractDriveFolderId(folderUrl: string): string | null {
  const trimmed = folderUrl.trim();

  const folderMatch = trimmed.match(/\/folders\/([a-zA-Z0-9_-]+)/);
  if (folderMatch) {
    return folderMatch[1];
  }

  const idParamMatch = trimmed.match(/[?&]id=([a-zA-Z0-9_-]+)/);
  if (idParamMatch) {
    return idParamMatch[1];
  }

  // A bare folder ID (no URL wrapper) is also accepted.
  if (/^[a-zA-Z0-9_-]{10,}$/.test(trimmed)) {
    return trimmed;
  }

  return null;
}

/**
 * True when the value is either empty — clearing the folder is allowed and is
 * how a folder is removed — or something we can resolve to a folder ID.
 */
export function isValidDriveFolderValue(value: string): boolean {
  const trimmed = value.trim();

  return trimmed === "" || extractDriveFolderId(trimmed) !== null;
}

export const DRIVE_FOLDER_ERROR =
  "Informe um link de pasta do Google Drive válido (ex.: https://drive.google.com/drive/folders/…) ou o ID da pasta.";
