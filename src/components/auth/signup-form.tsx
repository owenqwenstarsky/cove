"use client";

import Link from "next/link";
import { useActionState } from "react";
import { signup } from "@/app/auth-actions";
import { AuthCard } from "@/components/status";
import { Button } from "@/components/ui/button";
import { TextField } from "@/components/ui/field";

export function SignupForm({
  title,
  inviteToken,
  email,
}: {
  title: string;
  inviteToken?: string;
  email?: string;
}) {
  const [state, action, pending] = useActionState(signup, {});
  return (
    <AuthCard eyebrow="Join" title={title}>
      <form action={action} className="grid gap-4">
        {inviteToken ? <input type="hidden" name="invite" value={inviteToken} /> : null}
        <TextField label="Your name" name="name" autoComplete="name" required />
        <TextField label="Email" name="email" type="email" autoComplete="email" required defaultValue={email} readOnly={Boolean(email)} />
        <TextField label="Password" name="password" type="password" autoComplete="new-password" required minLength={8} />
        <TextField label="Confirm password" name="confirm" type="password" autoComplete="new-password" required minLength={8} />
        {state.error ? <p className="text-sm text-danger">{state.error}</p> : null}
        <Button type="submit" disabled={pending}>
          {pending ? "Creating…" : "Create account"}
        </Button>
      </form>
      <p className="mt-6 text-sm text-muted">
        <Link href="/login" className="text-tide underline">
          Already have an account
        </Link>
      </p>
    </AuthCard>
  );
}
