import assert from "node:assert/strict";
import { test } from "node:test";

import { storagePathFromPublicUrl } from "../lib/models/avatarStorage";
import { validateAvatarFile } from "../lib/models/avatarUpload";

const BASE =
  "https://zdifvgeyyugevhchtbie.supabase.co/storage/v1/object/public/model-avatars/";

test("extracts the object path from a public avatar URL", () => {
  const modelId = "d647f7cc-12f2-41a0-abad-2db2bcf31586";
  const file = "6b1f0a2e-1111-2222-3333-444455556666.jpg";

  assert.equal(
    storagePathFromPublicUrl(`${BASE}${modelId}/${file}`),
    `${modelId}/${file}`,
  );
});

test("ignores a cache-busting query string", () => {
  assert.equal(
    storagePathFromPublicUrl(`${BASE}abc/def.webp?t=1730000000`),
    "abc/def.webp",
  );
});

test("returns null for URLs we did not write", () => {
  // profile_photo_url is plain text and predates the bucket, so it can hold
  // anything. A replacement must never hand these to storage.remove().
  assert.equal(storagePathFromPublicUrl(null), null);
  assert.equal(storagePathFromPublicUrl(""), null);
  assert.equal(storagePathFromPublicUrl("https://example.com/foto.jpg"), null);
  assert.equal(
    storagePathFromPublicUrl(
      "https://zdifvgeyyugevhchtbie.supabase.co/storage/v1/object/public/model-documents/x/y.pdf",
    ),
    null,
  );
});

test("refuses paths that try to escape the bucket root", () => {
  assert.equal(storagePathFromPublicUrl(`${BASE}../model-documents/x.pdf`), null);
  assert.equal(storagePathFromPublicUrl(`${BASE}%2E%2E/secret.pdf`), null);
  assert.equal(storagePathFromPublicUrl(`${BASE}/leading-slash.jpg`), null);
});

function fakeFile(type: string, size: number): File {
  return { type, size } as File;
}

test("accepts the three supported image types", () => {
  for (const type of ["image/jpeg", "image/png", "image/webp"]) {
    assert.deepEqual(validateAvatarFile(fakeFile(type, 1024)), { ok: true });
  }
});

test("rejects other types and oversized files, naming the reason", () => {
  const wrongType = validateAvatarFile(fakeFile("application/pdf", 1024));
  assert.equal(wrongType.ok, false);
  assert.equal(
    wrongType.ok === false ? wrongType.messageKey : "",
    "fileTypeNotAllowed",
  );

  const tooBig = validateAvatarFile(
    fakeFile("image/jpeg", 5 * 1024 * 1024 + 1),
  );
  assert.equal(tooBig.ok, false);
  assert.equal(tooBig.ok === false ? tooBig.messageKey : "", "fileTooLarge");
});
