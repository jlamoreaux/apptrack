# Filename Sanitization Utility

## Overview

The filename sanitization utilities ensure that all uploaded files have safe, standardized filenames that work correctly across different systems and storage providers. This prevents issues with special characters, accents, and other non-ASCII characters.

## Problem

File uploads can fail when filenames contain:
- Accented characters (é, ñ, ü, etc.)
- Special symbols (@, #, !, etc.)
- Multiple consecutive spaces or special characters
- Unicode characters that aren't handled consistently

Example problematic filenames:
- `José's résumé.pdf`
- `John's CV (final)!!!.docx`
- `François Müller - Resume.pdf`

## Solution

Two utilities are provided:

### 1. Server-Side (`sanitize-filename.ts`)

Used in API routes and server components.

```typescript
import { sanitizeFilename, sanitizeFilenameWithTimestamp } from '@/lib/utils/sanitize-filename';

// Basic sanitization
const safe = sanitizeFilename("José's résumé.pdf");
// Result: "Joses_resume.pdf"

// With timestamp for uniqueness
const unique = sanitizeFilenameWithTimestamp("résumé.pdf", userId);
// Result: "user123_resume_1710345678901.pdf"
```

### 2. Client-Side (`sanitize-filename-client.ts`)

Used in React components and browser contexts.

```typescript
import { sanitizeFile, validateAndSanitizeFilename } from '@/lib/utils/sanitize-filename-client';

// Sanitize a File object (returns new File with safe name)
const handleFileSelect = (file: File) => {
  const sanitizedFile = sanitizeFile(file);
  // Use sanitizedFile for upload
};

// Check if filename needs sanitization
const result = validateAndSanitizeFilename(file.name);
if (result.changed) {
  console.warn(`Filename sanitized: ${result.original} → ${result.sanitized}`);
}
```

## How It Works

The sanitization process:

1. **Normalize Unicode** - Decomposes characters (é → e + accent)
2. **Remove diacritics** - Strips accent marks
3. **Replace spaces** - Converts spaces to underscores
4. **Remove special chars** - Keeps only alphanumeric, underscore, hyphen
5. **Collapse duplicates** - Multiple underscores/hyphens become one
6. **Trim edges** - Removes leading/trailing underscores and hyphens
7. **Preserve extension** - File extension remains unchanged

### Examples

| Original | Sanitized |
|----------|-----------|
| `résumé.pdf` | `resume.pdf` |
| `João García.pdf` | `Joao_Garcia.pdf` |
| `my  resume (2).docx` | `my_resume_2.docx` |
| `François's CV!!!.pdf` | `Francoiss_CV.pdf` |
| `___test___.txt` | `test.txt` |

## Where It's Already Implemented

### Server-Side

**`/app/api/resume/upload/route.ts`** (Line 203)
```typescript
const sanitizedName = sanitizeFilename(file.name);
const fileName = `resumes/${user.id}/${Date.now()}-${sanitizedName}`;
```

This is the main upload endpoint that stores files in Supabase Storage.

### Client-Side (Optional Enhancement)

For better UX, you can optionally sanitize filenames in components:

**Example: Resume Upload Dialog**
```typescript
const handleFileChange = (event: React.ChangeEvent<HTMLInputElement>) => {
  const file = event.target.files?.[0];
  if (!file) return;
  
  // Sanitize the file
  const sanitizedFile = sanitizeFile(file);
  
  // Show a warning if the name was changed
  const validation = validateAndSanitizeFilename(file.name);
  if (validation.changed) {
    toast.info(`Filename sanitized: ${validation.sanitized}`);
  }
  
  setSelectedFile(sanitizedFile);
};
```

## Testing

Tests are available in:
- `/lib/utils/__tests__/sanitize-filename.test.ts`

Run tests:
```bash
npm test sanitize-filename
```

## Best Practices

### ✅ DO

- Always sanitize filenames on the server before storage
- Use `sanitizeFilenameWithTimestamp` for guaranteed uniqueness
- Log the original and sanitized filenames for debugging
- Inform users if their filename was significantly changed

### ❌ DON'T

- Don't skip sanitization (even if client-side validation passes)
- Don't use the original filename directly for storage paths
- Don't assume file extensions are safe (they are, but sanitize anyway)
- Don't forget to preserve the file extension

## Migration Guide

If you're adding new file upload endpoints:

1. Import the utility:
   ```typescript
   import { sanitizeFilename } from '@/lib/utils/sanitize-filename';
   ```

2. Sanitize before creating storage path:
   ```typescript
   const sanitizedName = sanitizeFilename(file.name);
   const storagePath = `folder/${userId}/${Date.now()}-${sanitizedName}`;
   ```

3. (Optional) Add client-side feedback:
   ```typescript
   const result = validateAndSanitizeFilename(file.name);
   if (result.changed) {
     // Show user-friendly message
   }
   ```

## Security Considerations

- The utility removes potential path traversal characters (`../`)
- Prevents file name injection attacks
- Ensures consistent behavior across different operating systems
- Maintains file type integrity by preserving extensions

## Troubleshooting

**Issue**: File upload still fails with special characters

**Solution**: Ensure you're using the sanitized name for the storage path, not just the database record. Check:
```typescript
// ❌ Wrong - using original name
const path = `resumes/${userId}/${file.name}`;

// ✅ Correct - using sanitized name
const sanitizedName = sanitizeFilename(file.name);
const path = `resumes/${userId}/${Date.now()}-${sanitizedName}`;
```

**Issue**: Users don't understand why their filename changed

**Solution**: Add a toast notification:
```typescript
if (validation.changed) {
  toast.info(`Filename was adjusted for compatibility: "${validation.sanitized}"`);
}
```
