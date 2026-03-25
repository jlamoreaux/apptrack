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
    let rawText: string;

    switch (mimeType) {
      case "text/plain":
        rawText = buffer.toString("utf-8");
        break;

      case "application/pdf":
        const pdfData = await pdfParse(buffer);
        rawText = pdfData.text;
        break;

      case "application/msword": // .doc
      case "application/vnd.openxmlformats-officedocument.wordprocessingml.document": // .docx
        const docxData = await mammoth.extractRawText({ buffer });
        rawText = docxData.value;
        break;

      default:
        return {
          text: "",
          success: false,
          error: `Unsupported file type: ${mimeType}`,
        };
    }

    return {
      text: sanitizeTextForDb(rawText),
      success: true,
    };
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

/**
 * Sanitize text for safe PostgreSQL storage.
 * Removes null bytes (\u0000) and other control characters
 * that PostgreSQL rejects with "unsupported Unicode escape sequence".
 */
export function sanitizeTextForDb(text: string): string {
  return text
    .replace(/\u0000/g, "")
    .replace(/[\u0001-\u0008\u000B\u000C\u000E-\u001F\u007F-\u009F]/g, "");
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
