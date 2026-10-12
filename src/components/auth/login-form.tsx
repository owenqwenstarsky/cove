"use client";

import Link from "next/link";
import { useActionState } from "react";
import { login } from "@/app/auth-actions";
import { AuthCard } from "@/components/status";
import { Button } from "@/components/ui/button";
import { TextField } from "@/components/ui/field";
import type { RegistrationMode } from "@/lib/validate";

export function LoginForm({ siteName, registrationMode }: { siteName: string; registrationMode: RegistrationMode }) {
  const [state, action, pending] = useActionState(login, {});
  return (
    <AuthCard eyebrow={siteName} title="Sign in to your files.">
      <form action={action} className="grid gap-4">
        <TextField label="Email" name="email" type="email" autoComplete="email" required />
        <TextField label="Password" name="password" type="password" autoComplete="current-password" required />
        {state.error ? <p className="text-sm text-danger">{state.error}</p> : null}
        <Button type="submit" disabled={pending}>
          {pending ? "Signing in…" : "Sign in"}
        </Button>
      </form>
      <p className="mt-6 text-sm text-muted">
        {registrationMode === "open" ? (
          <Link href="/signup" className="text-tide underline">
            Create an account
          </Link>
        ) : registrationMode === "invite" ? (
          "Ask an admin for an invite link."
        ) : (
          "Ask an admin to create an account."
        )}
      </p>
    </AuthCard>
  );
}
