import { describe, it } from "node:test";
import assert from "node:assert/strict";

import {
  extractDriveFolderId,
  isValidDriveFolderValue,
} from "../lib/models/driveFolder";

describe("Google Drive folder references", () => {
  it("accepts a folder URL", () => {
    assert.equal(
      extractDriveFolderId(
        "https://drive.google.com/drive/folders/1a2B3c4D5e6F7g8H9i0J",
      ),
      "1a2B3c4D5e6F7g8H9i0J",
    );
  });

  it("accepts a folder URL carrying query parameters", () => {
    assert.equal(
      extractDriveFolderId(
        "https://drive.google.com/drive/folders/1a2B3c4D5e6F7g8H9i0J?usp=sharing",
      ),
      "1a2B3c4D5e6F7g8H9i0J",
    );
  });

  it("accepts an open?id= URL", () => {
    assert.equal(
      extractDriveFolderId(
        "https://drive.google.com/open?id=1a2B3c4D5e6F7g8H9i0J",
      ),
      "1a2B3c4D5e6F7g8H9i0J",
    );
  });

  it("accepts a bare folder id", () => {
    assert.equal(
      extractDriveFolderId("1a2B3c4D5e6F7g8H9i0J"),
      "1a2B3c4D5e6F7g8H9i0J",
    );
  });

  it("refuses something that is not a folder reference", () => {
    for (const value of [
      "pasta do drive",
      "https://example.com/whatever",
      "short",
      "https://drive.google.com/",
    ]) {
      assert.equal(
        extractDriveFolderId(value),
        null,
        `"${value}" must not resolve to a folder`,
      );
    }
  });

  it("treats an empty value as valid — that is how a folder is removed", () => {
    assert.equal(isValidDriveFolderValue(""), true);
    assert.equal(isValidDriveFolderValue("   "), true);
  });

  it("rejects a value that cannot be resolved to a folder", () => {
    assert.equal(isValidDriveFolderValue("pasta do drive"), false);
  });

  it("accepts every shape extractDriveFolderId resolves", () => {
    assert.equal(
      isValidDriveFolderValue(
        "https://drive.google.com/drive/folders/1a2B3c4D5e6F7g8H9i0J",
      ),
      true,
    );

    assert.equal(isValidDriveFolderValue("1a2B3c4D5e6F7g8H9i0J"), true);
  });
});
