"use client";

import { useState } from "react";
import { cn } from "@/lib/utils";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Eye, EyeOff, Loader2, AlertCircle } from "lucide-react";
import { loginAction } from "@/app/actions/auth";

export function LoginForm({
  className,
  ...props
}: React.ComponentPropsWithoutRef<"div">) {
  const [showPassword, setShowPassword] = useState(false);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const handleSubmit = async (e: React.FormEvent<HTMLFormElement>) => {
    e.preventDefault();
    setLoading(true);
    setError(null);
    
    const formData = new FormData(e.currentTarget);
    const result = await loginAction(formData);
    
    if (result?.error) {
      setError(result.error);
      setLoading(false);
    }
    // Note: on success, redirect happens in server action so we don't set loading false
  };

  return (
    <div className={cn("flex flex-col gap-6", className)} {...props}>
      <form onSubmit={handleSubmit}>
        {/* Glassmorphism card */}
        <div className="flex flex-col gap-5 rounded-2xl border border-white/20 bg-white/10 text-white shadow-2xl backdrop-blur-xl p-8">
          {/* Header */}
          <div className="flex flex-col gap-1">
            <h1 className="text-2xl font-bold tracking-tight">Login to your account</h1>
            <p className="text-sm text-white/60">
              Enter your email below to login to your account
            </p>
          </div>

          {/* Error Message */}
          {error && (
            <div className="flex items-center gap-2 rounded-md bg-destructive/15 p-3 text-sm text-destructive font-medium">
              <AlertCircle className="size-4" />
              {error}
            </div>
          )}

          {/* Fields */}
          <div className="grid gap-5">
            <div className="grid gap-2">
              <Label htmlFor="email" className="text-white/90 font-medium">
                Email
              </Label>
              <Input
                id="email"
                name="email"
                type="email"
                placeholder="m@example.com"
                required
                className="bg-white/10 border-white/20 text-white placeholder:text-white/30 focus:border-white/50 focus:bg-white/15 transition-all duration-200 h-11"
              />
            </div>

            <div className="grid gap-2">
              <div className="flex items-center justify-between">
                <Label htmlFor="password" className="text-white/90 font-medium">
                  Password
                </Label>
                <a
                  href="#"
                  className="text-sm text-white/60 underline-offset-4 hover:underline hover:text-white transition-colors"
                >
                  Forgot your password?
                </a>
              </div>
              <div className="relative">
                <Input
                  id="password"
                  name="password"
                  type={showPassword ? "text" : "password"}
                  required
                  className="bg-white/10 border-white/20 text-white focus:border-white/50 focus:bg-white/15 transition-all duration-200 h-11 pr-10"
                />
                <button
                  type="button"
                  onClick={() => setShowPassword(!showPassword)}
                  className="absolute right-3 top-1/2 -translate-y-1/2 text-white/50 hover:text-white transition-colors"
                  tabIndex={-1}
                >
                  {showPassword ? <EyeOff className="size-4" /> : <Eye className="size-4" />}
                </button>
              </div>
            </div>
          </div>

          {/* Login Button */}
          <Button
            type="submit"
            disabled={loading}
            className="w-full h-11 font-semibold bg-white text-black hover:bg-white/90 transition-all duration-200 active:scale-[0.98]"
          >
            {loading ? (
              <>
                <Loader2 className="mr-2 size-4 animate-spin" />
                Signing in...
              </>
            ) : (
              "Login"
            )}
          </Button>

          {/* Sign up */}
          <p className="text-center text-sm text-white/60">
            Don&apos;t have an account?{" "}
            <a
              href="#"
              className="text-white font-medium underline underline-offset-4 hover:opacity-80 transition-opacity"
            >
              Sign up
            </a>
          </p>
        </div>
      </form>
    </div>
  );
}
