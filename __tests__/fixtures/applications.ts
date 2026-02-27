/**
 * Shared test fixtures for application objects
 */

export const makeApplication = (overrides: Partial<{
  id: string;
  user_id: string;
  company: string;
  role: string;
  role_link: string | null;
  job_description: string | null;
  date_applied: string;
  status: "Applied" | "Interview Scheduled" | "Interviewed" | "Offer" | "Rejected" | "Hired";
  notes: string | null;
  archived: boolean | null;
  created_at: string;
  updated_at: string;
}> = {}) => ({
  id: 'app-id-001',
  user_id: 'user-id-001',
  company: 'Acme Corp',
  role: 'Software Engineer',
  role_link: null,
  job_description: null,
  date_applied: '2024-01-15',
  status: 'Applied' as const,
  notes: null,
  archived: false,
  created_at: '2024-01-15T00:00:00Z',
  updated_at: '2024-01-15T00:00:00Z',
  ...overrides,
});

export const makeApplicationHistory = (overrides: Partial<{
  id: string;
  application_id: string;
  old_status: string | null;
  new_status: string;
  changed_at: string;
  notes: string | null;
}> = {}) => ({
  id: 'hist-id-001',
  application_id: 'app-id-001',
  old_status: null,
  new_status: 'Applied',
  changed_at: '2024-01-15T00:00:00Z',
  notes: null,
  ...overrides,
});

export const SAMPLE_STAGES = [
  'Applied',
  'Interview Scheduled',
  'Interviewed',
  'Offer',
  'Hired',
  'Rejected',
];

export const appliedApp = makeApplication({ id: 'app-001', status: 'Applied' });
export const interviewScheduledApp = makeApplication({ id: 'app-002', status: 'Interview Scheduled' });
export const interviewedApp = makeApplication({ id: 'app-003', status: 'Interviewed' });
export const offerApp = makeApplication({ id: 'app-004', status: 'Offer' });
export const hiredApp = makeApplication({ id: 'app-005', status: 'Hired' });
export const rejectedApp = makeApplication({ id: 'app-006', status: 'Rejected' });
