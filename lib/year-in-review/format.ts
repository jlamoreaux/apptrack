export const MONTH_NAMES = [
  "January", "February", "March", "April", "May", "June",
  "July", "August", "September", "October", "November", "December",
] as const;

export function plural(count: number, one: string, many: string): string {
  return `${count.toLocaleString("en-US")} ${count === 1 ? one : many}`;
}

/** "2026-03-02" to "March 2", without passing through a local-time Date. */
export function formatDayMonth(isoDate: string): string {
  const month = Number(isoDate.slice(5, 7));
  const day = Number(isoDate.slice(8, 10));
  return `${MONTH_NAMES[month - 1]} ${day}`;
}
