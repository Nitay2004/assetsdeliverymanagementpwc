import { getSession } from "@/lib/auth";
import { logoutAction } from "@/app/actions/logout";
import { redirect } from "next/navigation";
import { UserAvatar } from "./user-avatar";
import { AddButton } from "./add-button";
import { GlobalSearch } from "./global-search";

export async function Header() {
  const user = await getSession();

  if (!user) {
    redirect("/");
  }

  return (
    <header className="h-16 glass flex items-center justify-between px-6 shadow-sm border-b-0 gap-4">
      <div className="flex items-center gap-4 shrink-0">
        <h2 className="text-lg font-semibold tracking-tight text-foreground hidden sm:block">
          Asset Management Portal
        </h2>
      </div>

      <GlobalSearch />

      <div className="flex items-center gap-3 shrink-0">
        {user.role === "ADMIN" && <AddButton />}
        <UserAvatar
          user={{ email: user.email, role: user.role, name: user.name }}
          logoutAction={logoutAction}
        />
      </div>
    </header>
  );
}
