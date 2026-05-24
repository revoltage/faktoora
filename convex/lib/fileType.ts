export type DetectedFileType =
  | "application/pdf"
  | "image/png"
  | "image/jpeg"
  | "image/webp";

/**
 * Detect the MIME type of a binary file from its leading magic bytes.
 *
 * Supports PDF, PNG, JPEG and WEBP. Defaults to "application/pdf" when no
 * signature matches so downstream PDF parsers still get a chance to inspect
 * the file (mirrors prior behavior split across invoiceAnalysis and
 * invoiceParsing).
 */
export function detectFileType(buffer: ArrayBuffer): DetectedFileType {
  const arr = new Uint8Array(buffer).subarray(0, 12);

  // PDF: %PDF
  if (
    arr[0] === 0x25 &&
    arr[1] === 0x50 &&
    arr[2] === 0x44 &&
    arr[3] === 0x46
  ) {
    return "application/pdf";
  }

  // PNG: 89 50 4E 47
  if (
    arr[0] === 0x89 &&
    arr[1] === 0x50 &&
    arr[2] === 0x4e &&
    arr[3] === 0x47
  ) {
    return "image/png";
  }

  // JPEG: FF D8 FF
  if (arr[0] === 0xff && arr[1] === 0xd8 && arr[2] === 0xff) {
    return "image/jpeg";
  }

  // WEBP: RIFF....WEBP
  if (
    arr[0] === 0x52 &&
    arr[1] === 0x49 &&
    arr[2] === 0x46 &&
    arr[3] === 0x46 &&
    arr[8] === 0x57 &&
    arr[9] === 0x45 &&
    arr[10] === 0x42 &&
    arr[11] === 0x50
  ) {
    return "image/webp";
  }

  return "application/pdf";
}
