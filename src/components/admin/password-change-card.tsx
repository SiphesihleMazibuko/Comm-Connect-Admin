"use client";

import type { User } from "@supabase/supabase-js";
import { CheckCircle2, Eye, EyeOff, Loader2, LockKeyhole } from "lucide-react";
import { useState } from "react";

import { Button } from "@/components/ui/button";
import { supabase } from "@/lib/supabase";

type PasswordChangeCardProps = {
  user: User;
  onDone: () => void;
};

export function PasswordChangeCard({ user, onDone }: PasswordChangeCardProps) {
  const [password, setPassword] = useState("");
  const [confirm, setConfirm] = useState("");
  const [passwordVisible, setPasswordVisible] = useState(false);
  const [confirmVisible, setConfirmVisible] = useState(false);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const updatePassword = async (event: React.FormEvent<HTMLFormElement>) => {
    event.preventDefault();
    console.log("[AdminPassword] Password update submitted", {
      userId: user.id,
      email: user.email,
      passwordLength: password.length,
      confirmationMatches: password === confirm,
    });

    if (password.length < 8) {
      console.warn("[AdminPassword] Password rejected by local validation: too short");
      setError("Use at least 8 characters.");
      return;
    }

    if (password !== confirm) {
      console.warn("[AdminPassword] Password rejected by local validation: mismatch");
      setError("Passwords do not match.");
      return;
    }

    setLoading(true);
    setError(null);

    try {
      const { data, error: updateError } = await supabase.auth.updateUser({
        password,
        data: {
          ...user.user_metadata,
          password_updated_at: new Date().toISOString(),
        },
      });
      const updateErrorDetails = updateError
        ? {
            name: updateError.name,
            message: updateError.message,
            status: updateError.status,
            code: updateError.code,
          }
        : null;

      console.log("[AdminPassword] Supabase updateUser response", {
        userId: data.user?.id,
        error: updateErrorDetails,
      });

      if (updateError) {
        console.error("[AdminPassword] Password update rejected by Supabase", updateErrorDetails);
        setError(
          [
            updateError.message,
            updateError.status ? `Status: ${updateError.status}` : null,
            updateError.code ? `Code: ${updateError.code}` : null,
          ]
            .filter(Boolean)
            .join(" | "),
        );
        return;
      }

      console.log("[AdminPassword] Password update succeeded, loading dashboard");
      onDone();
    } catch (updateException) {
      console.error("[AdminPassword] Unexpected password update exception", updateException);
      setError(updateException instanceof Error ? updateException.message : "Unexpected password update error.");
    } finally {
      setLoading(false);
    }
  };

  return (
    <main className="flex min-h-screen items-center justify-center bg-zinc-100 px-4">
      <section className="w-full max-w-md rounded-lg border border-zinc-200 bg-white p-6 shadow-sm">
        <div className="flex size-12 items-center justify-center rounded-lg bg-amber-50 text-amber-700">
          <LockKeyhole className="size-6" />
        </div>
        <h1 className="mt-5 text-2xl font-black text-zinc-950">Change Admin Password</h1>
        <p className="mt-2 text-sm text-zinc-500">
          Company-issued admin passwords must be replaced regularly. Create a new password before continuing.
        </p>
        <form className="mt-6 space-y-4" onSubmit={updatePassword}>
          <div className="relative">
            <input
              className="h-11 w-full rounded-lg border border-zinc-200 px-3 pr-11 outline-none focus:border-blue-500 focus:ring-4 focus:ring-blue-100"
              type={passwordVisible ? "text" : "password"}
              placeholder="New password"
              value={password}
              onChange={(event) => setPassword(event.target.value)}
              required
            />
            <button
              type="button"
              className="absolute right-3 top-1/2 -translate-y-1/2 text-zinc-500"
              onClick={() => setPasswordVisible((visible) => !visible)}
              aria-label={passwordVisible ? "Hide password" : "Show password"}
            >
              {passwordVisible ? <EyeOff className="size-4" /> : <Eye className="size-4" />}
            </button>
          </div>
          <div className="relative">
            <input
              className="h-11 w-full rounded-lg border border-zinc-200 px-3 pr-11 outline-none focus:border-blue-500 focus:ring-4 focus:ring-blue-100"
              type={confirmVisible ? "text" : "password"}
              placeholder="Confirm new password"
              value={confirm}
              onChange={(event) => setConfirm(event.target.value)}
              required
            />
            <button
              type="button"
              className="absolute right-3 top-1/2 -translate-y-1/2 text-zinc-500"
              onClick={() => setConfirmVisible((visible) => !visible)}
              aria-label={confirmVisible ? "Hide confirmation password" : "Show confirmation password"}
            >
              {confirmVisible ? <EyeOff className="size-4" /> : <Eye className="size-4" />}
            </button>
          </div>
          {error ? (
            <p className="rounded-lg border border-red-200 bg-red-50 p-3 text-sm font-semibold text-red-700">{error}</p>
          ) : null}
          <Button type="submit" className="h-11 w-full" disabled={loading}>
            {loading ? <Loader2 className="animate-spin" /> : <CheckCircle2 />}
            Update password
          </Button>
        </form>
      </section>
    </main>
  );
}
