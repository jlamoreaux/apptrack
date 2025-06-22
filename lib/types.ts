export interface Application {
  id: string;
  status: string;
  role?: string;
  role_link?: string;
  company?: string;
  date_applied?: string;
  created_at?: string;
  updated_at?: string;
  user_id?: string;
  archived?: boolean;
}

export interface ApplicationHistory {
  application_id: string;
  old_status: string | null;
  new_status: string;
  changed_at: string;
  notes?: string | null;
}
