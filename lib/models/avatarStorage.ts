/**
 * Storage-path helpers for the `model-avatars` bucket.
 *
 * Kept out of the route module because a Next.js route file may only export
 * HTTP handlers and route config — and because this is the one piece of the
 * upload worth unit testing on its own (see tests/avatar-storage.test.ts).
 */

export const AVATAR_BUCKET = "model-avatars";

const PUBLIC_OBJECT_MARKER = `/storage/v1/object/public/${AVATAR_BUCKET}/`;

/**
 * The object path behind a public avatar URL, or null when the URL is not one
 * of ours. Public object URLs look like
 * `<project>/storage/v1/object/public/model-avatars/<model_id>/<uuid>.<ext>`.
 *
 * Anything else — a URL from another bucket, an externally hosted image, a
 * malformed value — returns null, so a replacement never hands an unrelated
 * path to storage.remove(). profile_photo_url is a plain text column that
 * predates this bucket, so it genuinely can hold URLs we did not write.
 */
export function storagePathFromPublicUrl(
  publicUrl: string | null | undefined,
): string | null {
  if (!publicUrl) {
    return null;
  }

  const markerIndex = publicUrl.indexOf(PUBLIC_OBJECT_MARKER);

  if (markerIndex === -1) {
    return null;
  }

  const rawPath = publicUrl
    .slice(markerIndex + PUBLIC_OBJECT_MARKER.length)
    .split("?")[0]
    .split("#")[0]
    .trim();

  if (!rawPath) {
    return null;
  }

  let path: string;

  try {
    path = decodeURIComponent(rawPath);
  } catch {
    return null;
  }

  // Never let a stored value walk out of the bucket root.
  if (path.startsWith("/") || path.split("/").includes("..")) {
    return null;
  }

  return path;
}
