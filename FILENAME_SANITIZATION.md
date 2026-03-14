# Filename Sanitization Implementation

## Overview

This document describes the filename sanitization feature implemented to prevent file upload issues with special characters, accents, and other non-standard characters.

## Problem

File uploads were failing when filenames contained non-standard characters such as:
- Accented characters: `é`, `ñ`, `ü`, `ø`
- Apostrophes and quotes: `'`, `"`
- Special symbols: `@`, `#`, `!`, `&`
- Unicode characters and emojis: `🚀`, `™`

Example problematic filename: `José's résumé.pdf`

## Solution

A comprehensive filename sanitization utility was created with the following features:

### Core Functionality

1. **Unicode Normalization** - Decomposes Unicode characters (NFD)
2. **Diacritic Removal** - Strips accent marks (`é` → `e`)
3. **Space Replacement** - Converts spaces to underscores
4. **Special Character Removal** - Keeps only alphanumeric, underscore, hyphen
5. **Duplicate Collapse** - Multiple consecutive special chars become one
6. **Edge Trimming** - Removes leading/trailing underscores and hyphens
7. **Extension Preservation** - File extensions remain unchanged

### Files Created

```
lib/utils/
├── sanitize-filename.ts              # Core server-side utility
├── sanitize-filename-client.ts       # Client-side wrapper
├── sanitize-filename.md              # Detailed documentation
└── __tests__/
    ├── sanitize-filename.test.ts              # Unit tests
    └── sanitize-filename-examples.test.ts     # Real-world examples
```

## Usage

### Server-Side (API Routes)

```typescript
import { sanitizeFilename } from '@/lib/utils/sanitize-filename';

// In upload handler
const sanitizedName = sanitizeFilename(file.name);
const fileName = `resumes/${userId}/${Date.now()}-${sanitizedName}`;
```

### Client-Side (Components)

```typescript
import { sanitizeFile } from '@/lib/utils/sanitize-filename-client';

const handleFileSelect = (file: File) => {
  const sanitizedFile = sanitizeFile(file);
  // Upload sanitizedFile
};
```

## Integration Points

### Currently Implemented

✅ **`/app/api/resume/upload/route.ts`** (Line 203)
- Main resume upload endpoint
- Files uploaded to Supabase Storage bucket `resumes`
- Sanitization applied before storage path creation

### No Changes Required

The following endpoints don't upload to storage (text extraction only):
- `/app/api/try/upload-resume/route.ts`
- `/app/api/ai-coach/upload-resume/route.ts`
- `/app/api/roast/route.ts`

## Examples

| Original Filename | Sanitized Filename |
|------------------|-------------------|
| `résumé.pdf` | `resume.pdf` |
| `José García Resume.pdf` | `Jose_Garcia_Resume.pdf` |
| `John's Resume (final)!!!.pdf` | `Johns_Resume_final.pdf` |
| `François Müller - CV @2024.docx` | `Francois_Muller_CV_2024.docx` |
| `Resume 🚀.pdf` | `Resume.pdf` |

## Testing

All tests pass successfully:

```bash
npm test -- sanitize-filename.test.ts
npm test -- sanitize-filename-examples.test.ts
```

**Test Coverage:**
- ✅ 15 unit tests for core functionality
- ✅ 15 real-world example tests
- ✅ Edge cases and international characters
- ✅ Timestamp-based filename generation

## Security Benefits

1. **Path Traversal Protection** - Removes `../` and similar patterns
2. **Injection Prevention** - Strips potentially harmful characters
3. **Cross-Platform Compatibility** - Works on Windows, Mac, Linux
4. **Storage Provider Compatibility** - Safe for Supabase, S3, etc.

## Future Enhancements (Optional)

1. **Client-Side Feedback**
   - Show toast notification when filename is sanitized
   - Display before/after comparison to user

2. **Logging**
   - Track how often sanitization makes changes
   - Monitor for patterns in problematic filenames

3. **Configuration**
   - Allow customization of allowed characters
   - Configurable max filename length

## Related Documentation

- **Main Docs:** `lib/utils/sanitize-filename.md`
- **Tests:** `lib/utils/__tests__/sanitize-filename.test.ts`
- **Examples:** `lib/utils/__tests__/sanitize-filename-examples.test.ts`

## Rollout

✅ **Completed**
- Utility implementation
- Unit tests
- Integration with main upload endpoint
- Documentation

⏸️ **Optional** (not required for core functionality)
- Client-side feedback/notifications
- Analytics tracking
- Admin dashboard metrics
