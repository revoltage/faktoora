import { afterEach, describe, expect, test, vi } from "vitest";

import { uploadFileToStorage } from "./storageUpload";

describe("storage upload", () => {
  afterEach(() => {
    vi.restoreAllMocks();
    vi.unstubAllGlobals();
  });

  test("hashes and uploads a file", async () => {
    const generateUploadUrl = vi.fn().mockResolvedValue("https://upload.test");
    const fetchMock = vi.fn().mockResolvedValue({
      ok: true,
      json: vi.fn().mockResolvedValue({ storageId: "st1" }),
    });
    vi.stubGlobal("fetch", fetchMock);
    const file = new File(["known content"], "invoice.pdf", {
      type: "application/pdf",
    });

    const result = await uploadFileToStorage(file, generateUploadUrl);

    expect(result.storageId).toBe("st1");
    expect(result.fileHash).toMatch(/^[0-9a-f]{64}$/);
    expect(generateUploadUrl).toHaveBeenCalledOnce();
    expect(fetchMock).toHaveBeenCalledWith("https://upload.test", {
      method: "POST",
      headers: { "Content-Type": "application/pdf" },
      body: file,
    });
  });

  test("rejects a non-ok upload response", async () => {
    vi.stubGlobal(
      "fetch",
      vi.fn().mockResolvedValue({ ok: false, status: 500 }),
    );
    const file = new File(["content"], "invoice.pdf", {
      type: "application/pdf",
    });

    await expect(
      uploadFileToStorage(
        file,
        vi.fn().mockResolvedValue("https://upload.test"),
      ),
    ).rejects.toThrow("HTTP 500");
  });

  test("still uploads when hashing fails", async () => {
    vi.spyOn(crypto.subtle, "digest").mockRejectedValue(
      new Error("hash failed"),
    );
    const fetchMock = vi.fn().mockResolvedValue({
      ok: true,
      json: vi.fn().mockResolvedValue({ storageId: "st1" }),
    });
    vi.stubGlobal("fetch", fetchMock);
    const file = new File(["content"], "invoice.pdf", {
      type: "application/pdf",
    });

    await expect(
      uploadFileToStorage(
        file,
        vi.fn().mockResolvedValue("https://upload.test"),
      ),
    ).resolves.toEqual({ storageId: "st1", fileHash: undefined });
    expect(fetchMock).toHaveBeenCalledOnce();
  });
});
