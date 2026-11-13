import type { ReactNode } from "react";
import { requireSuperadmin } from "@/lib/server/require-superadmin";

export default async function MatrixLayout({ children }: { children: ReactNode }) {
  await requireSuperadmin();
  return children;
}
