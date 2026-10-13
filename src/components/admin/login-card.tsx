"use client";

import { Eye, EyeOff, Loader2, ShieldCheck } from "lucide-react";
import Image from "next/image";
import { useState } from "react";

import { Button } from "@/components/ui/button";
import { supabase, supabaseConfigError } from "@/lib/supabase";

type LoginCardProps = {
  onSignedIn: () => void;
};

export function LoginCard({ onSignedIn }: LoginCardProps) {
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [passwordVisible, setPasswordVisible] = useState(false);
  const [loading, setLoading] = useState(false);
  const [resetLoading, setResetLoading] = useState(false);
  const [error, setError] = useState<string | null>(supabaseConfigError);
  const [notice, setNotice] = useState<string | null>(null);

  const signIn = async (event: React.FormEvent<HTMLFormElement>) => {
    event.preventDefault();
    console.log("[AdminLogin] Sign in submitted", {
      email,
      hasPassword: password.length > 0,
      supabaseConfigError,
    });

    if (supabaseConfigError) {
      console.error(
        "[AdminLogin] Supabase configuration error",
        supabaseConfigError,
      );
      setError(supabaseConfigError);
      return;
    }

    setLoading(true);
    setError(null);
    setNotice(null);

    try {
      const { data, error: signInError } =
        await supabase.auth.signInWithPassword({ email, password });
      const signInErrorDetails = signInError
        ? {
            name: signInError.name,
            message: signInError.message,
            status: signInError.status,
            code: signInError.code,
          }
        : null;

      console.log("[AdminLogin] Supabase signInWithPassword response", {
        hasSession: !!data.session,
        userId: data.user?.id,
        error: signInErrorDetails,
      });

      if (signInError) {
        console.error(
          "[AdminLogin] Sign in rejected by Supabase",
          signInErrorDetails,
        );
        setError(
          [
            signInError.message,
            signInError.status ? `Status: ${signInError.status}` : null,
            signInError.code ? `Code: ${signInError.code}` : null,
          ]
            .filter(Boolean)
            .join(" | "),
        );
        return;
      }

      console.log("[AdminLogin] Sign in succeeded, loading dashboard");
      onSignedIn();
    } catch (signInException) {
      console.error(
        "[AdminLogin] Unexpected sign in exception",
        signInException,
      );
      setError(
        signInException instanceof Error
          ? signInException.message
          : "Unexpected sign in error.",
      );
    } finally {
      setLoading(false);
    }
  };

  const sendPasswordReset = async () => {
    setError(null);
    setNotice(null);

    if (!email) {
      setError("Enter your admin email first, then click Change password.");
      return;
    }

    setResetLoading(true);
    const { error: resetError } = await supabase.auth.resetPasswordForEmail(
      email,
      {
        redirectTo:
          typeof window === "undefined" ? undefined : window.location.origin,
      },
    );
    setResetLoading(false);

    if (resetError) {
      setError(resetError.message);
      return;
    }

    setNotice("Password reset link sent. Check the admin email inbox.");
  };

  return (
    <main className="flex min-h-screen items-center justify-center bg-zinc-100 px-4">
      <section className="w-full max-w-md rounded-lg border border-zinc-200 bg-white p-6 shadow-sm">
        <div className="mx-auto flex size-20 items-center justify-center">
          <Image
            src="/logo.png"
            alt="Comm-Connect logo"
            width={80}
            height={80}
            className="h-16 w-16 object-contain"
            priority
          />
        </div>
        <h1 className="mt-5 text-center text-2xl font-black text-zinc-950">
          Comm-Connect Admin Panel
        </h1>

        <form className="mt-6 space-y-4" onSubmit={signIn}>
          <label className="block text-sm font-bold text-zinc-700">
            Email
            <input
              className="mt-2 h-11 w-full rounded-lg border border-zinc-200 px-3 font-normal outline-none focus:border-blue-500 focus:ring-4 focus:ring-blue-100"
              type="email"
              value={email}
              onChange={(event) => setEmail(event.target.value)}
              required
            />
          </label>
          <label className="block text-sm font-bold text-zinc-700">
            Password
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
          <button
            type="button"
            className="text-sm font-bold text-blue-700 hover:underline"
            onClick={sendPasswordReset}
            disabled={resetLoading}
          >
            {resetLoading ? "Sending reset link..." : "Change password"}
          </button>
          {error ? (
            <p className="rounded-lg border border-red-200 bg-red-50 p-3 text-sm font-semibold text-red-700">
              {error}
            </p>
          ) : null}
          {notice ? (
            <p className="rounded-lg border border-emerald-200 bg-emerald-50 p-3 text-sm font-semibold text-emerald-700">
              {notice}
            </p>
          ) : null}
          <Button type="submit" className="h-11 w-full" disabled={loading}>
            {loading ? <Loader2 className="animate-spin" /> : <ShieldCheck />}
            Sign in
          </Button>
        </form>
      </section>
    </main>
  );
}
