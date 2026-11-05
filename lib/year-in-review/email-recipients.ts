import { fetchApplicationEmailRows, type RawApplicationEmailRow } from "@/lib/email/application-rows";
import { LABEL_THRESHOLDS } from "./labels";

/**
 * Who gets which version of the recap email. "labeled" users have a search
 * style waiting to be revealed; "light" users have a recap but no label.
 */
export type RecapAudience = "labeled" | "light";

export interface RecapRecipient {
  userId: string;
  email: string;
  firstName?: string;
  applications: number;
  hired: boolean;
  audience: RecapAudience;
}

type RecipientRow = Pick<RawApplicationEmailRow, "user_id" | "email" | "full_name" | "status">;

/**
 * One recipient per user with at least one application in the year, ordered
 * by userId so a send can resume from a cursor. Archived applications count,
 * matching the recap itself.
 */
export function buildRecapRecipients(rows: RecipientRow[]): RecapRecipient[] {
  const byUser = new Map<string, RecapRecipient>();
  for (const row of rows) {
    let recipient = byUser.get(row.user_id);
    if (!recipient) {
      recipient = {
        userId: row.user_id,
        email: row.email,
        firstName: row.full_name?.trim().split(/\s+/)[0] || undefined,
        applications: 0,
        hired: false,
        audience: "light",
      };
      byUser.set(row.user_id, recipient);
    }
    recipient.applications++;
    if (row.status === "Hired") recipient.hired = true;
  }

  const recipients = Array.from(byUser.values());
  for (const recipient of recipients) {
    // Same threshold the label rules use, so "labeled" always means a label is waiting.
    recipient.audience = recipient.applications >= LABEL_THRESHOLDS.minApplications ? "labeled" : "light";
  }
  return recipients.sort((a, b) => (a.userId < b.userId ? -1 : a.userId > b.userId ? 1 : 0));
}

export async function findRecapRecipients(year: number): Promise<RecapRecipient[]> {
  const rows = await fetchApplicationEmailRows(
    (query) => query.gte("date_applied", `${year}-01-01`).lte("date_applied", `${year}-12-31`),
    "year_in_review_email_query_failed"
  );
  return buildRecapRecipients(rows);
}
