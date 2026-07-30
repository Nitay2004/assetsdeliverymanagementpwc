import { Sidebar } from "@/components/dashboard/sidebar";
import { Header } from "@/components/dashboard/header";
import { ModuleGuard } from "@/components/dashboard/module-guard";
import { BackgroundGrid } from "@/components/dashboard/floating-gradient-mesh";
import { getSession } from "@/lib/auth";

export default async function DashboardLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  const user = await getSession();
  const role = user?.role ?? null;
  const permissions = user?.permissions ?? null;

  return (
    <div className="relative flex min-h-screen bg-gradient-to-br from-blue-50 via-sky-50/80 to-indigo-100 dark:from-[#0a0a0f] dark:via-[#0d0d1a] dark:to-[#0a0a14]">
      <div className="relative z-10 flex flex-1 min-w-0">
        <Sidebar role={role} permissions={permissions} />
        <div className="relative flex flex-col min-w-0 flex-1">
          <BackgroundGrid />
          <Header />
          <main className="flex-1 overflow-y-auto p-3 sm:p-4 md:p-6">
            <ModuleGuard role={role} permissions={permissions}>
              {children}
            </ModuleGuard>
          </main>
        </div>
      </div>
    </div>
  );
}
