"use client";

import { usePathname, useRouter } from "next/navigation";
import { useEffect } from "react";
import { canViewModule, routeToModule } from "@/lib/permissions";

export function ModuleGuard({
  children,
  role,
  permissions,
}: {
  children: React.ReactNode;
  role: string | null;
  permissions: unknown | null;
}) {
  const pathname = usePathname();
  const router = useRouter();

  useEffect(() => {
    if (role === "ADMIN") return;
    if (!pathname.startsWith("/dashboard")) return;

    const moduleId = routeToModule[pathname];
    if (!moduleId) return;

    if (!canViewModule(permissions, role, moduleId)) {
      router.replace("/dashboard");
    }
  }, [pathname, role, permissions, router]);

  return <>{children}</>;
}
