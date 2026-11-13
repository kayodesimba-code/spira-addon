import type { Metadata } from "next";
import { requireSuperadmin } from "@/lib/server/require-superadmin";
import { ActivityLog } from "./activity-log";

export const metadata: Metadata = { title: "Activity" };

export default async function ActivityPage() {
  await requireSuperadmin();
  return <ActivityLog />;
}
