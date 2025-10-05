"use node";

export interface ParsingResult {
  text: string;
  success: boolean;
  error?: string;
}

export async function parsePdfFromBuffer(
  buffer: Buffer
): Promise<ParsingResult> {
  try {
    const { PDFParse } = await import("pdf-parse");

    const parser = new PDFParse({ data: buffer });
    const textResult = await parser.getText();

    return {
      text: textResult.text,
      success: true,
    };
  } catch (error) {
    return {
      text: "",
      success: false,
      error: error instanceof Error ? error.message : "Unknown parsing error",
    };
  }
}

export async function parsePdfFromBlob(blob: Blob): Promise<ParsingResult> {
  try {
    // Convert Blob to ArrayBuffer, then to Buffer for pdf-parse
    const arrayBuffer = await blob.arrayBuffer();
    const buffer = Buffer.from(arrayBuffer);

    return await parsePdfFromBuffer(buffer);
  } catch (error) {
    return {
      text: "",
      success: false,
      error: error instanceof Error ? error.message : "File conversion error",
    };
  }
}
