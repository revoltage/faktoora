import type { StorageId } from "@/lib/types";

/**
 * SHA-256 of the file, hex-encoded. Returns undefined when hashing fails —
 * the hash is only used for server-side duplicate detection, never required.
 */
async function computeFileHash(file: File): Promise<string | undefined> {
  try {
    const arrayBuffer = await file.arrayBuffer();
    const hashBuffer = await crypto.subtle.digest("SHA-256", arrayBuffer);
    return Array.from(new Uint8Array(hashBuffer))
      .map((b) => b.toString(16).padStart(2, "0"))
      .join("");
  } catch {
    return undefined;
  }
}

/** Shared upload pipeline: best-effort hash → upload URL → POST → storageId. */
export async function uploadFileToStorage(
  file: File,
  generateUploadUrl: () => Promise<string>,
): Promise<{ storageId: StorageId; fileHash: string | undefined }> {
  const fileHash = await computeFileHash(file);
  const uploadUrl = await generateUploadUrl();
  const response = await fetch(uploadUrl, {
    method: "POST",
    headers: { "Content-Type": file.type },
    body: file,
  });
  if (!response.ok) {
    throw new Error(`Failed to upload file (HTTP ${response.status})`);
  }
  const { storageId } = (await response.json()) as { storageId: StorageId };
  return { storageId, fileHash };
}
