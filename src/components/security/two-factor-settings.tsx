"use client";

import { useState } from "react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import {
  ShieldCheck,
  ShieldOff,
  Loader2,
  AlertCircle,
  CheckCircle2,
  Copy,
  RefreshCw,
  QrCode,
  KeyRound,
} from "lucide-react";
import {
  startTwoFactorSetupAction,
  confirmTwoFactorSetupAction,
  disableTwoFactorAction,
  regenerateRecoveryCodesAction,
} from "@/app/actions/two-factor";
import { cn } from "@/lib/utils";

type PasswordPrompt = "disable" | "regenerate" | null;

export function TwoFactorSettings({
  enabled,
  recoveryCodesRemaining,
}: {
  enabled: boolean;
  recoveryCodesRemaining: number;
}) {
  const [enrolling, setEnrolling] = useState(false);
  const [qrDataUrl, setQrDataUrl] = useState<string | null>(null);
  const [secret, setSecret] = useState<string | null>(null);
  const [isEnabled, setIsEnabled] = useState(enabled);
  const [codesRemaining, setCodesRemaining] = useState(recoveryCodesRemaining);
  const [recoveryCodes, setRecoveryCodes] = useState<string[] | null>(null);
  const [passwordPrompt, setPasswordPrompt] = useState<PasswordPrompt>(null);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [copied, setCopied] = useState(false);

  const handleStart = async () => {
    setLoading(true);
    setError(null);
    const result = await startTwoFactorSetupAction();
    setQrDataUrl(result.qrDataUrl);
    setSecret(result.secret);
    setEnrolling(true);
    setLoading(false);
  };

  const handleConfirm = async (e: React.FormEvent<HTMLFormElement>) => {
    e.preventDefault();
    setLoading(true);
    setError(null);

    const result = await confirmTwoFactorSetupAction(new FormData(e.currentTarget));

    if (!result.success) {
      setError(result.error ?? "Could not enable two-factor authentication.");
      setLoading(false);
      return;
    }

    setIsEnabled(true);
    setCodesRemaining(result.recoveryCodes.length);
    setRecoveryCodes(result.recoveryCodes);
    setEnrolling(false);
    setQrDataUrl(null);
    setSecret(null);
    setLoading(false);
  };

  const handlePasswordAction = async (e: React.FormEvent<HTMLFormElement>) => {
    e.preventDefault();
    if (!passwordPrompt) return;

    setLoading(true);
    setError(null);

    const formData = new FormData(e.currentTarget);

    if (passwordPrompt === "disable") {
      const result = await disableTwoFactorAction(formData);
      if (!result.success) {
        setError(result.error ?? "Could not turn off two-factor authentication.");
        setLoading(false);
        return;
      }
      setIsEnabled(false);
      setCodesRemaining(0);
    } else {
      const result = await regenerateRecoveryCodesAction(formData);
      if (!result.success) {
        setError(result.error ?? "Could not generate new recovery codes.");
        setLoading(false);
        return;
      }
      setCodesRemaining(result.recoveryCodes.length);
      setRecoveryCodes(result.recoveryCodes);
    }

    setPasswordPrompt(null);
    setLoading(false);
  };

  const handleCancel = () => {
    setEnrolling(false);
    setQrDataUrl(null);
    setSecret(null);
    setPasswordPrompt(null);
    setError(null);
  };

  const handleCopy = async (text: string) => {
    try {
      await navigator.clipboard.writeText(text);
      setCopied(true);
      setTimeout(() => setCopied(false), 2000);
    } catch {
      setError("Could not copy to clipboard. Select the text and copy manually.");
    }
  };

  return (
    <div className="space-y-6">
      {/* Status */}
      <div className="p-5 rounded-xl glass shadow-sm flex items-start gap-4">
        <div className={cn("p-3 rounded-lg", isEnabled ? "bg-green-100" : "bg-amber-100")}>
          {isEnabled ? (
            <ShieldCheck className="size-5 text-green-600" />
          ) : (
            <ShieldOff className="size-5 text-amber-600" />
          )}
        </div>
        <div className="min-w-0 flex-1">
          <p className="text-sm font-semibold text-foreground">
            {isEnabled ? "Two-factor authentication is on" : "Two-factor authentication is off"}
          </p>
          <p className="text-sm text-muted-foreground mt-1">
            {isEnabled
              ? "After your password, you are asked for a 6-digit code from your authenticator app."
              : "Add a second step to sign-in so a stolen password alone cannot get into your account."}
          </p>
          {isEnabled && (
            <p className="text-xs text-muted-foreground mt-2">
              Recovery codes left:{" "}
              <span
                className={cn(
                  "font-semibold",
                  codesRemaining <= 2 ? "text-destructive" : "text-foreground"
                )}
              >
                {codesRemaining}
              </span>
              {codesRemaining <= 2 && " — regenerate them before you run out."}
            </p>
          )}
        </div>
      </div>

      {error && (
        <div className="flex items-center gap-2 rounded-lg bg-destructive/10 p-3 text-sm text-destructive font-medium">
          <AlertCircle className="size-4" />
          {error}
        </div>
      )}

      {/* One-time recovery code display */}
      {recoveryCodes && (
        <div className="p-5 rounded-xl glass shadow-sm space-y-4 border border-green-500/30">
          <div className="flex items-center gap-2 text-sm font-semibold text-foreground">
            <CheckCircle2 className="size-4 text-green-600" />
            Save your recovery codes
          </div>
          <p className="text-sm text-muted-foreground">
            Each code works once. They are the only way back in if you lose your phone,
            so store them somewhere safe (not on the same device).
          </p>
          <ul className="grid gap-2 sm:grid-cols-2">
            {recoveryCodes.map((code) => (
              <li
                key={code}
                className="rounded-lg bg-background border px-3 py-2 font-mono text-sm tracking-wider"
              >
                {code}
              </li>
            ))}
          </ul>
          <div className="flex gap-2">
            <Button
              type="button"
              variant="outline"
              size="sm"
              onClick={() => handleCopy(recoveryCodes.join("\n"))}
            >
              {copied ? <CheckCircle2 /> : <Copy />}
              {copied ? "Copied" : "Copy all"}
            </Button>
            <Button type="button" variant="ghost" size="sm" onClick={() => setRecoveryCodes(null)}>
              I&apos;ve saved them
            </Button>
          </div>
        </div>
      )}

      {/* Enrolment */}
      {enrolling && !recoveryCodes && (
        <div className="p-5 rounded-xl glass shadow-sm space-y-5">
          <div className="space-y-2">
            <p className="text-sm font-semibold text-foreground flex items-center gap-2">
              <QrCode className="size-4" />
              1. Scan this QR code
            </p>
            <p className="text-sm text-muted-foreground">
              Use Google Authenticator, Microsoft Authenticator, Authy, or 1Password.
            </p>
          </div>

          {qrDataUrl && (
            <div className="flex flex-col items-start gap-4 sm:flex-row sm:items-center">
              {/* eslint-disable-next-line @next/next/no-img-element */}
              <img
                src={qrDataUrl}
                alt="Two-factor authentication QR code"
                className="size-56 rounded-lg border bg-white p-2"
              />
              <div className="space-y-2 text-sm">
                <p className="text-muted-foreground">
                  Can&apos;t scan? Enter this key manually in your app:
                </p>
                <code className="block break-all rounded-lg bg-muted px-3 py-2 font-mono text-xs">
                  {secret}
                </code>
                <Button
                  type="button"
                  variant="ghost"
                  size="xs"
                  onClick={() => handleCopy(secret ?? "")}
                >
                  {copied ? <CheckCircle2 /> : <Copy />}
                  {copied ? "Copied" : "Copy key"}
                </Button>
              </div>
            </div>
          )}

          <form onSubmit={handleConfirm} className="space-y-3">
            <div className="space-y-2">
              <Label htmlFor="code" className="text-sm font-medium">
                2. Enter the 6-digit code from your app
              </Label>
              <Input
                id="code"
                name="code"
                inputMode="numeric"
                autoComplete="one-time-code"
                spellCheck={false}
                maxLength={6}
                placeholder="000000"
                required
                className="h-10 max-w-48 font-mono tracking-[0.4em]"
              />
            </div>
            <div className="flex gap-2">
              <Button type="submit" disabled={loading}>
                {loading && <Loader2 className="animate-spin" />}
                Verify and turn on
              </Button>
              <Button type="button" variant="ghost" onClick={handleCancel}>
                Cancel
              </Button>
            </div>
          </form>
        </div>
      )}

      {/* Password prompt for sensitive changes */}
      {passwordPrompt && (
        <form onSubmit={handlePasswordAction} className="p-5 rounded-xl glass shadow-sm space-y-4">
          <p className="text-sm font-semibold text-foreground flex items-center gap-2">
            <KeyRound className="size-4" />
            {passwordPrompt === "disable"
              ? "Confirm your password to turn 2FA off"
              : "Confirm your password to generate new recovery codes"}
          </p>
          <div className="space-y-2 max-w-sm">
            <Label htmlFor="confirm-password" className="text-sm font-medium">
              Password
            </Label>
            <Input
              id="confirm-password"
              name="password"
              type="password"
              required
              autoComplete="current-password"
            />
          </div>
          <div className="flex gap-2">
            <Button type="submit" disabled={loading}>
              {loading && <Loader2 className="animate-spin" />}
              Confirm
            </Button>
            <Button
              type="button"
              variant="ghost"
              onClick={() => {
                setPasswordPrompt(null);
                setError(null);
              }}
            >
              Cancel
            </Button>
          </div>
        </form>
      )}

      {/* Actions */}
      {!enrolling && !passwordPrompt && !recoveryCodes && (
        <div className="flex flex-wrap gap-2">
          {isEnabled ? (
            <>
              <Button
                type="button"
                variant="outline"
                onClick={() => setPasswordPrompt("regenerate")}
              >
                <RefreshCw />
                New recovery codes
              </Button>
              <Button
                type="button"
                variant="destructive"
                onClick={() => setPasswordPrompt("disable")}
              >
                <ShieldOff />
                Turn off 2FA
              </Button>
            </>
          ) : (
            <Button type="button" onClick={handleStart} disabled={loading}>
              {loading ? <Loader2 className="animate-spin" /> : <ShieldCheck />}
              Set up two-factor authentication
            </Button>
          )}
        </div>
      )}
    </div>
  );
}
