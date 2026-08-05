import { getSession } from "@/lib/auth";
import { logoutAction } from "@/app/actions/logout";
import { redirect } from "next/navigation";
import { UserAvatar } from "./user-avatar";
import { AddButton } from "./add-button";
import { GlobalSearch } from "./global-search";
import { ScrambleText } from "./scramble-text";

export async function Header() {
  const user = await getSession();

  if (!user) {
    redirect("/api/auth/clear-session");
  }

  return (
    <header className="h-14 sm:h-16 glass flex items-center justify-between px-3 sm:px-6 shadow-sm border-b-0 gap-2 sm:gap-4">
      <div className="flex items-center gap-4 shrink-0 pl-10 md:pl-0">
        <h2 className="text-base sm:text-lg font-semibold tracking-tight text-foreground hidden sm:block">
          <ScrambleText text="Asset Management Portal" duration={3000} />
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
