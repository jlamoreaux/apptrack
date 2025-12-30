/**
 * File type validation using magic bytes
 * Prevents file type spoofing by inspecting actual file headers
 */

import { fileTypeFromBuffer } from 'file-type';

/**
 * Allowed MIME types for resume uploads
 */
const ALLOWED_MIME_TYPES = [
  'application/pdf',
  'application/msword', // .doc
  'application/vnd.openxmlformats-officedocument.wordprocessingml.document', // .docx
  'text/plain', // .txt
] as const;

/**
 * Mapping of expected magic byte MIME types to claimed MIME types
 * Some formats like .docx are actually ZIP files, so we need to accept their container format
 */
const MIME_TYPE_ALIASES: Record<string, string[]> = {
  'application/pdf': ['application/pdf'],
  'application/msword': ['application/msword', 'application/x-msword'],
  'application/vnd.openxmlformats-officedocument.wordprocessingml.document': [
    'application/zip', // .docx files are ZIP containers
    'application/vnd.openxmlformats-officedocument.wordprocessingml.document',
  ],
  'text/plain': ['text/plain'],
};

export interface FileTypeValidationResult {
  valid: boolean;
  detectedType?: string;
  claimedType: string;
  error?: string;
}

/**
 * Validates a file's type using magic byte inspection
 *
 * @param buffer - The file buffer to validate
 * @param claimedMimeType - The MIME type claimed by the client
 * @returns Validation result with detected type and validity
 */
export async function validateFileType(
  buffer: Buffer,
  claimedMimeType: string
): Promise<FileTypeValidationResult> {
  try {
    // Check if claimed MIME type is in allowed list
    if (!ALLOWED_MIME_TYPES.includes(claimedMimeType as any)) {
      return {
        valid: false,
        claimedType: claimedMimeType,
        error: `File type '${claimedMimeType}' is not allowed. Allowed types: PDF, DOC, DOCX, TXT`,
      };
    }

    // Detect actual file type from magic bytes
    const detectedType = await fileTypeFromBuffer(buffer);

    // For plain text files, magic bytes detection might not work
    // (text files often have no magic bytes)
    if (!detectedType && claimedMimeType === 'text/plain') {
      // Verify it's actually text by checking if it's valid UTF-8
      try {
        const text = buffer.toString('utf8');
        // Check if the content is mostly printable ASCII/UTF-8
        const printableRatio = text.split('').filter(c => {
          const code = c.charCodeAt(0);
          return (code >= 32 && code <= 126) || code === 9 || code === 10 || code === 13 || code > 127;
        }).length / text.length;

        if (printableRatio > 0.95) {
          return {
            valid: true,
            detectedType: 'text/plain',
            claimedType: claimedMimeType,
          };
        } else {
          return {
            valid: false,
            claimedType: claimedMimeType,
            detectedType: undefined,
            error: 'File does not appear to be valid text',
          };
        }
      } catch {
        return {
          valid: false,
          claimedType: claimedMimeType,
          error: 'File is not valid UTF-8 text',
        };
      }
    }

    // If no type detected and it's not text, it's invalid
    if (!detectedType) {
      return {
        valid: false,
        claimedType: claimedMimeType,
        error: 'Could not detect file type from file content',
      };
    }

    // Check if detected type matches claimed type (considering aliases)
    const allowedDetectedTypes = MIME_TYPE_ALIASES[claimedMimeType] || [claimedMimeType];

    if (allowedDetectedTypes.includes(detectedType.mime)) {
      // Additional validation for PDFs
      if (claimedMimeType === 'application/pdf') {
        if (!validatePDFStructure(buffer)) {
          return {
            valid: false,
            detectedType: detectedType.mime,
            claimedType: claimedMimeType,
            error: 'File does not appear to be a valid PDF (missing required PDF markers)',
          };
        }
      }

      return {
        valid: true,
        detectedType: detectedType.mime,
        claimedType: claimedMimeType,
      };
    }

    // Type mismatch - possible spoofing attempt
    return {
      valid: false,
      detectedType: detectedType.mime,
      claimedType: claimedMimeType,
      error: `File type mismatch: claimed '${claimedMimeType}' but detected '${detectedType.mime}'`,
    };
  } catch (error) {
    return {
      valid: false,
      claimedType: claimedMimeType,
      error: error instanceof Error ? error.message : 'Unknown validation error',
    };
  }
}

/**
 * Quick check if a MIME type is in the allowed list
 * Use this for early validation before reading the full file
 */
export function isAllowedMimeType(mimeType: string): boolean {
  return ALLOWED_MIME_TYPES.includes(mimeType as any);
}

/**
 * Additional validation for PDF files
 * Checks for proper PDF header and footer markers
 *
 * @param buffer - The file buffer to validate
 * @returns true if the file appears to be a valid PDF
 */
export function validatePDFStructure(buffer: Buffer): boolean {
  try {
    // PDF files must start with %PDF-
    const header = buffer.slice(0, 5).toString('ascii');
    if (!header.startsWith('%PDF-')) {
      return false;
    }

    // PDF files should end with %%EOF (check last 1KB for it)
    const footer = buffer.slice(-1024).toString('ascii');
    if (!footer.includes('%%EOF')) {
      return false;
    }

    // Additional check: PDF version should be valid (1.0 through 2.0)
    const versionMatch = header.match(/%PDF-(\d\.\d)/);
    if (versionMatch) {
      const version = parseFloat(versionMatch[1]);
      if (version < 1.0 || version > 2.0) {
        return false;
      }
    }

    return true;
  } catch {
    return false;
  }
}
