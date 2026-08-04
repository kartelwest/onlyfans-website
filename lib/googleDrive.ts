import "server-only";

import { google } from "googleapis";
import { Readable } from "node:stream";

// Uploads content into a model's existing Google Drive folder on behalf of
// the agency, via a Google Cloud service account. The folder itself lives in
// an agency Google account and must be shared with the service account's
// email (found in GOOGLE_SERVICE_ACCOUNT_EMAIL) as an Editor — service
// accounts have no access to anything that hasn't been explicitly shared with
// them. Requires the `drive` scope (not `drive.file`) because the folder was
// not created by this service account.
function getServiceAccountCredentials() {
  const email = process.env.GOOGLE_SERVICE_ACCOUNT_EMAIL;
  const privateKey = process.env.GOOGLE_SERVICE_ACCOUNT_PRIVATE_KEY;

  if (!email || !privateKey) {
    return null;
  }

  return {
    email,
    // Env vars typically escape newlines; unescape them back to real ones.
    privateKey: privateKey.replace(/\\n/g, "\n"),
  };
}

export function isDriveUploadConfigured() {
  return getServiceAccountCredentials() !== null;
}

function getDriveClient() {
  const credentials = getServiceAccountCredentials();

  if (!credentials) {
    throw new Error(
      "Google Drive não está configurado (GOOGLE_SERVICE_ACCOUNT_EMAIL / GOOGLE_SERVICE_ACCOUNT_PRIVATE_KEY ausentes).",
    );
  }

  const auth = new google.auth.JWT({
    email: credentials.email,
    key: credentials.privateKey,
    scopes: ["https://www.googleapis.com/auth/drive"],
  });

  return google.drive({ version: "v3", auth });
}

// Parsing a folder reference is not a server concern — the admin screens have
// to apply the same rule as they type. It lives in lib/models/driveFolder.ts
// and is re-exported here so this module stays the one import for uploads.
export { extractDriveFolderId } from "@/lib/models/driveFolder";

export async function uploadFileToDriveFolder(
  folderId: string,
  file: {
    name: string;
    mimeType: string;
    buffer: Buffer;
  },
): Promise<{ id: string; webViewLink: string | null }> {
  const drive = getDriveClient();

  const response = await drive.files.create({
    requestBody: {
      name: file.name,
      parents: [folderId],
    },
    media: {
      mimeType: file.mimeType,
      body: Readable.from(file.buffer),
    },
    fields: "id, webViewLink",
    supportsAllDrives: true,
  });

  if (!response.data.id) {
    throw new Error("O Google Drive não retornou um ID de arquivo.");
  }

  return {
    id: response.data.id,
    webViewLink: response.data.webViewLink ?? null,
  };
}
