"use node";

export interface ParsingResult {
  text: string;
  success: boolean;
  error?: string;
  pageImages?: Array<{
    pageNumber: number;
    data: Buffer;
  }>;
}

export async function parsePdfFromBuffer(
  buffer: Buffer
): Promise<ParsingResult> {
  try {
    const { PDFParse } = await import("pdf-parse");

    const parser = new PDFParse({ data: buffer });
    
    // Get text first (always needed)
    const textResult = await parser.getText();

    // Try to get page images with timeout
    let imageResult = { pages: [] };
    try {
      const imagePromise = parser.pageToImage();
      
      // Add a timeout to prevent hanging
      const timeoutPromise = new Promise((_, reject) => 
        setTimeout(() => reject(new Error("Image rendering timeout")), 30000)
      );
      
      // @ts-expect-error - pdf-parse types are not correct
      imageResult = await Promise.race([imagePromise, timeoutPromise]);
      if (imageResult.pages.length > 0) {
        console.log(`📸 Rendered ${imageResult.pages.length} page images`);
      }
    } catch (error) {
      console.error("📸 Image rendering failed:", error instanceof Error ? error.message : String(error));
    }

    return {
      text: textResult.text,
      success: true,
      pageImages: imageResult.pages.map((page: any) => ({
        pageNumber: page.pageNumber,
        data: Buffer.from(page.data),
      })),
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
