/**
 * Tests for lib/actions/schemas.ts
 * Zod validation schemas for all forms
 */

// @jest-environment node

import {
  signUpSchema,
  signInSchema,
  applicationSchema,
  linkedinProfileSchema,
  profileUpdateSchema,
} from '@/lib/actions/schemas';

describe('signUpSchema', () => {
  const validSignUp = {
    name: 'John Doe',
    email: 'john@example.com',
    password: 'SecurePass1!',
    confirmPassword: 'SecurePass1!',
  };

  it('accepts valid signup data', () => {
    expect(() => signUpSchema.parse(validSignUp)).not.toThrow();
  });

  it('rejects password shorter than 8 chars', () => {
    const result = signUpSchema.safeParse({ ...validSignUp, password: 'Ab1!', confirmPassword: 'Ab1!' });
    expect(result.success).toBe(false);
  });

  it('rejects password without uppercase letter', () => {
    const result = signUpSchema.safeParse({ ...validSignUp, password: 'securepass1!', confirmPassword: 'securepass1!' });
    expect(result.success).toBe(false);
  });

  it('rejects password without number', () => {
    const result = signUpSchema.safeParse({ ...validSignUp, password: 'SecurePass!', confirmPassword: 'SecurePass!' });
    expect(result.success).toBe(false);
  });

  it('rejects password without special character', () => {
    const result = signUpSchema.safeParse({ ...validSignUp, password: 'SecurePass1', confirmPassword: 'SecurePass1' });
    expect(result.success).toBe(false);
  });

  it('rejects mismatched confirmPassword', () => {
    const result = signUpSchema.safeParse({ ...validSignUp, confirmPassword: 'DifferentPass1!' });
    expect(result.success).toBe(false);
    if (!result.success) {
      expect(result.error.issues.some(i => i.path.includes('confirmPassword'))).toBe(true);
    }
  });

  it('rejects invalid email format', () => {
    const result = signUpSchema.safeParse({ ...validSignUp, email: 'not-an-email' });
    expect(result.success).toBe(false);
  });

  it('rejects missing name', () => {
    const result = signUpSchema.safeParse({ ...validSignUp, name: '' });
    expect(result.success).toBe(false);
  });
});

describe('signInSchema', () => {
  it('accepts valid email and password', () => {
    const result = signInSchema.safeParse({ email: 'user@example.com', password: 'anypassword' });
    expect(result.success).toBe(true);
  });

  it('rejects empty password', () => {
    const result = signInSchema.safeParse({ email: 'user@example.com', password: '' });
    expect(result.success).toBe(false);
  });

  it('rejects invalid email format', () => {
    const result = signInSchema.safeParse({ email: 'not-email', password: 'password123' });
    expect(result.success).toBe(false);
  });
});

describe('applicationSchema', () => {
  const validApp = {
    company: 'Acme Corp',
    role: 'Software Engineer',
    date_applied: '2024-01-15',
    status: 'Applied' as const,
  };

  it('accepts valid application with required fields', () => {
    expect(() => applicationSchema.parse(validApp)).not.toThrow();
  });

  it('rejects missing company name', () => {
    const result = applicationSchema.safeParse({ ...validApp, company: '' });
    expect(result.success).toBe(false);
  });

  it('rejects missing role', () => {
    const result = applicationSchema.safeParse({ ...validApp, role: '' });
    expect(result.success).toBe(false);
  });

  it('rejects invalid status value', () => {
    const result = applicationSchema.safeParse({ ...validApp, status: 'Pending' });
    expect(result.success).toBe(false);
  });

  it('accepts empty string for optional role_link', () => {
    const result = applicationSchema.safeParse({ ...validApp, role_link: '' });
    expect(result.success).toBe(true);
  });

  it('rejects malformed URL for role_link', () => {
    const result = applicationSchema.safeParse({ ...validApp, role_link: 'not-a-url' });
    expect(result.success).toBe(false);
  });

  it('accepts valid URL for role_link', () => {
    const result = applicationSchema.safeParse({ ...validApp, role_link: 'https://example.com/job' });
    expect(result.success).toBe(true);
  });

  it('accepts all valid status values', () => {
    const validStatuses = ['Applied', 'Interview Scheduled', 'Interviewed', 'Offer', 'Rejected'];
    validStatuses.forEach(status => {
      const result = applicationSchema.safeParse({ ...validApp, status });
      expect(result.success).toBe(true);
    });
  });

  it('accepts optional job_description field', () => {
    const result = applicationSchema.safeParse({ ...validApp, job_description: 'Some description' });
    expect(result.success).toBe(true);
  });
});

describe('linkedinProfileSchema', () => {
  it('accepts valid LinkedIn URL', () => {
    const result = linkedinProfileSchema.safeParse({ profile_url: 'https://www.linkedin.com/in/john-doe' });
    expect(result.success).toBe(true);
  });

  it('rejects non-URL profile_url', () => {
    const result = linkedinProfileSchema.safeParse({ profile_url: 'not-a-url' });
    expect(result.success).toBe(false);
  });

  it('accepts optional name and title fields', () => {
    const result = linkedinProfileSchema.safeParse({
      profile_url: 'https://linkedin.com/in/user',
      name: 'John Doe',
      title: 'Engineer',
    });
    expect(result.success).toBe(true);
  });
});

describe('profileUpdateSchema', () => {
  it('accepts valid full_name', () => {
    const result = profileUpdateSchema.safeParse({ full_name: 'Jane Smith' });
    expect(result.success).toBe(true);
  });

  it('rejects empty full_name', () => {
    const result = profileUpdateSchema.safeParse({ full_name: '' });
    expect(result.success).toBe(false);
  });
});
