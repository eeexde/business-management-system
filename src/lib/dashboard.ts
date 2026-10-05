/** Pure helpers for the dashboard (greeting, activity feed). */

export function firstName(name: string) {
  return name.trim().split(/\s+/)[0] || name;
}

/** "Good morning" / "Good afternoon" / "Good evening" for an hour 0-23. */
export function greeting(hour: number) {
  if (hour < 5) return "Good evening";
  if (hour < 12) return "Good morning";
  if (hour < 18) return "Good afternoon";
  return "Good evening";
}

/** Compact relative time for an ISO timestamp, e.g. "just now", "5m ago", "3h ago", "2d ago". */
export function relativeTime(iso: string, now: Date) {
  const then = Date.parse(iso);
  if (Number.isNaN(then)) return "";
  const seconds = Math.max(0, Math.round((now.getTime() - then) / 1000));
  if (seconds < 60) return "just now";
  const minutes = Math.floor(seconds / 60);
  if (minutes < 60) return `${minutes}m ago`;
  const hours = Math.floor(minutes / 60);
  if (hours < 24) return `${hours}h ago`;
  const days = Math.floor(hours / 24);
  if (days === 1) return "yesterday";
  if (days < 7) return `${days}d ago`;
  if (days < 30) return `${Math.floor(days / 7)}w ago`;
  return new Date(then).toLocaleDateString("en-US", { month: "short", day: "numeric", year: "numeric" });
}

/** Where an activity entry links to, or null when there is no page for it. */
export function activityHref(entityType: string, entityId: number | null): string | null {
  switch (entityType) {
    case "invoice":
      return entityId ? `/invoices/${entityId}` : "/invoices";
    case "customer":
      return entityId ? `/customers/${entityId}` : "/customers";
    case "product":
      return entityId ? `/products/${entityId}` : "/products";
    case "expense":
      return "/expenses";
    case "task":
      return "/tasks";
    case "settings":
    case "user":
      return null;
    default:
      return null;
  }
}
