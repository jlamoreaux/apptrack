import pdfParse from "pdf-parse";
import mammoth from "mammoth";

export interface TextExtractionResult {
  text: string;
  success: boolean;
  error?: string;
}

export async function extractTextFromBuffer(
  buffer: Buffer,
  mimeType: string,
  fileName: string
): Promise<TextExtractionResult> {
  try {
    switch (mimeType) {
      case "text/plain":
        return {
          text: buffer.toString("utf-8"),
          success: true,
        };

      case "application/pdf":
        const pdfData = await pdfParse(buffer);
        return {
          text: pdfData.text,
          success: true,
        };

      case "application/msword": // .doc
      case "application/vnd.openxmlformats-officedocument.wordprocessingml.document": // .docx
        const docxData = await mammoth.extractRawText({ buffer });
        return {
          text: docxData.value,
          success: true,
        };

      default:
        return {
          text: "",
          success: false,
          error: `Unsupported file type: ${mimeType}`,
        };
    }
  } catch (error) {
    return {
      text: "",
      success: false,
      error: `Text extraction failed: ${
        error instanceof Error ? error.message : "Unknown error"
      }`,
    };
  }
}

export function getFileTypeLabel(mimeType: string): string {
  switch (mimeType) {
    case "application/pdf":
      return "PDF";
    case "application/msword":
      return "DOC";
    case "application/vnd.openxmlformats-officedocument.wordprocessingml.document":
      return "DOCX";
    case "text/plain":
      return "TXT";
    default:
      return "Unknown";
  }
}

export function isSupportedFileType(mimeType: string): boolean {
  const supportedTypes = [
    "application/pdf",
    "application/msword",
    "application/vnd.openxmlformats-officedocument.wordprocessingml.document",
    "text/plain",
  ];
  return supportedTypes.includes(mimeType);
}
