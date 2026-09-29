import { redirect } from "next/navigation";
import { getSession } from "@/lib/auth";
import { prisma } from "@/lib/prisma";
import { TwoFactorSettings } from "@/components/security/two-factor-settings";

export default async function SecurityPage() {
  const user = await getSession();
  if (!user) redirect("/");

  const recoveryCodesRemaining = user.twoFactorEnabled
    ? await prisma.twoFactorRecoveryCode.count({ where: { userId: user.id, usedAt: null } })
    : 0;

  return (
    <div className="max-w-3xl mx-auto space-y-8">
      <div>
        <h1 className="text-3xl font-bold tracking-tight text-foreground">Security</h1>
        <p className="text-muted-foreground mt-2">
          Protect your account with a second sign-in step and recovery codes.
        </p>
      </div>

      <div>
        <h2 className="text-lg font-semibold text-foreground">Two-factor authentication</h2>
        <p className="text-sm text-muted-foreground mt-1 mb-4">
          Signed in as <span className="font-medium text-foreground">{user.email}</span>
        </p>
        <TwoFactorSettings
          enabled={user.twoFactorEnabled}
          recoveryCodesRemaining={recoveryCodesRemaining}
        />
      </div>
    </div>
  );
}
