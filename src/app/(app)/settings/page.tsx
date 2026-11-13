import type { Metadata } from "next";
import { requireSuperadmin } from "@/lib/server/require-superadmin";
import { SettingsForm } from "./settings-form";

export const metadata: Metadata = { title: "Settings" };

export default async function SettingsPage() {
  await requireSuperadmin();
  return <SettingsForm />;
}
