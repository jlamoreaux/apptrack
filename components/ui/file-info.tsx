"use client";

import { cn } from "@/lib/utils";

interface FileInfoProps {
  fileName: string;
  characterCount?: number;
  className?: string;
  showCharacterCount?: boolean;
}

export function FileInfo({
  fileName,
  characterCount,
  className,
  showCharacterCount = true,
}: FileInfoProps) {
  // Function to truncate filename intelligently
  const getTruncatedFileName = (name: string) => {
    // Remove common prefixes like "Resume_" or "Resume-"
    const cleanName = name.replace(/^Resume[_\s-]+/i, "");
    
    // Extract file extension
    const lastDotIndex = cleanName.lastIndexOf(".");
    const extension = lastDotIndex > 0 ? cleanName.substring(lastDotIndex) : "";
    const nameWithoutExt = lastDotIndex > 0 ? cleanName.substring(0, lastDotIndex) : cleanName;
    
    // On mobile, show truncated version but keep more characters
    const maxLength = 35; // Increased for better readability
    
    if (nameWithoutExt.length > maxLength) {
      // Keep more of the beginning and show extension
      return `${nameWithoutExt.substring(0, maxLength - 3)}...${extension}`;
    }
    
    // If it fits, show the full cleaned name
    return cleanName;
  };
  
  return (
    <div className={cn("space-y-1", className)}>
      <p className="font-medium truncate" title={fileName}>
        <span className="sm:hidden">{getTruncatedFileName(fileName)}</span>
        <span className="hidden sm:inline">{fileName}</span>
      </p>
      {showCharacterCount && characterCount !== undefined && (
        <p className="text-sm text-muted-foreground">
          {characterCount.toLocaleString()} characters
        </p>
      )}
    </div>
  );
}