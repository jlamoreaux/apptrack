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
