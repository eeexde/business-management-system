/**
 * Public demo protection. With DEMO_MODE=true, account, team and business-settings
 * changes are disabled so one visitor can't lock others out of the shared demo.
 * Day-to-day business data (customers, invoices, tasks…) stays fully editable.
 */
export const DEMO_MODE = process.env.DEMO_MODE === "true";

export const DEMO_LOCKED_MESSAGE =
  "This is a public demo, so account, team and business settings are read-only. Everything else is editable.";

export function demoLocked(): { ok: false; message: string } | null {
  return DEMO_MODE ? { ok: false, message: DEMO_LOCKED_MESSAGE } : null;
}
