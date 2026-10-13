"use client";

import type { User } from "@supabase/supabase-js";
import { CheckCircle2, Eye, EyeOff, Loader2 } from "lucide-react";
import { useState } from "react";

import { Button } from "@/components/ui/button";
import { supabase } from "@/lib/supabase";

type ProfilePasswordFormProps = {
  user: User;
  onUpdated?: () => void;
};

export function ProfilePasswordForm({ user, onUpdated }: ProfilePasswordFormProps) {
  const [password, setPassword] = useState("");
  const [confirm, setConfirm] = useState("");
  const [passwordVisible, setPasswordVisible] = useState(false);
  const [confirmVisible, setConfirmVisible] = useState(false);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [notice, setNotice] = useState<string | null>(null);

  const updatePassword = async (event: React.FormEvent<HTMLFormElement>) => {
    event.preventDefault();
    setError(null);
    setNotice(null);

    if (password.length < 8) {
      setError("Use at least 8 characters.");
      return;
    }

    if (password !== confirm) {
      setError("Passwords do not match.");
      return;
    }

    setLoading(true);
    const { error: updateError } = await supabase.auth.updateUser({
      password,
      data: {
        ...user.user_metadata,
        password_updated_at: new Date().toISOString(),
      },
    });
    setLoading(false);

    if (updateError) {
      setError(updateError.message);
      return;
    }

    setPassword("");
    setConfirm("");
    setNotice("Password updated successfully.");
    onUpdated?.();
  };

  return (
    <form className="space-y-4" onSubmit={updatePassword}>
      <div className="grid gap-4 md:grid-cols-2">
        <label className="block text-sm font-bold text-zinc-700">
          New password
          <span className="relative mt-2 block">
            <input
              className="h-11 w-full rounded-lg border border-zinc-200 px-3 pr-11 font-normal outline-none focus:border-blue-500 focus:ring-4 focus:ring-blue-100"
              type={passwordVisible ? "text" : "password"}
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
          </span>
        </label>
        <label className="block text-sm font-bold text-zinc-700">
          Confirm password
          <span className="relative mt-2 block">
            <input
              className="h-11 w-full rounded-lg border border-zinc-200 px-3 pr-11 font-normal outline-none focus:border-blue-500 focus:ring-4 focus:ring-blue-100"
              type={confirmVisible ? "text" : "password"}
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
          </span>
        </label>
      </div>
      {error ? <p className="rounded-lg border border-red-200 bg-red-50 p-3 text-sm font-semibold text-red-700">{error}</p> : null}
      {notice ? <p className="rounded-lg border border-emerald-200 bg-emerald-50 p-3 text-sm font-semibold text-emerald-700">{notice}</p> : null}
      <Button type="submit" disabled={loading}>
        {loading ? <Loader2 className="animate-spin" /> : <CheckCircle2 />}
        Update password
      </Button>
    </form>
  );
}
