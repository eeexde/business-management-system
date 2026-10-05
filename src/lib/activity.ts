import "server-only";
import { db } from "@/db";
import { activityLog } from "@/db/schema";

export async function logActivity(entry: {
  userId: number | null;
  action: string;
  entityType: string;
  entityId?: number | null;
  summary: string;
}) {
  await db.insert(activityLog).values({ ...entry, entityId: entry.entityId ?? null });
}
