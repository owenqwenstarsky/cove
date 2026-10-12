"use client";

import { useActionState } from "react";
import { useRouter } from "next/navigation";
import { useEffect } from "react";
import { saveSiteSettings } from "@/app/admin/actions";
import { createInvite, revokeInvite } from "@/app/auth-actions";
import { Button } from "@/components/ui/button";
import { SelectField, TextField } from "@/components/ui/field";
import type { RegistrationMode } from "@/lib/validate";

export function SettingsForm({
  siteName,
  registrationMode,
  quotaGb,
  uploadMb,
  invites,
}: {
  siteName: string;
  registrationMode: RegistrationMode;
  quotaGb: number;
  uploadMb: number;
  invites: { id: string; url: string; email: string | null; expiresAt: string }[];
}) {
  const [state, action, pending] = useActionState(saveSiteSettings, {});
  const [inviteState, inviteAction, invitePending] = useActionState(createInvite, {});
  const router = useRouter();
  useEffect(() => {
    if (inviteState.ok) router.refresh();
  }, [inviteState.ok, router]);

  return (
    <div className="grid gap-10">
      <form action={action} className="grid max-w-xl gap-4">
        <h1 className="font-display text-4xl italic">Settings</h1>
        <TextField label="Site name" name="siteName" required defaultValue={siteName} />
        <SelectField label="Who can join" name="registrationMode" defaultValue={registrationMode}>
          <option value="closed">Only admins create accounts</option>
          <option value="invite">Invite links</option>
          <option value="open">Anyone can sign up</option>
        </SelectField>
        <TextField label="Default storage per person (GB)" name="quotaGb" type="number" min={1} required defaultValue={quotaGb} />
        <TextField label="Largest upload (MB)" name="uploadMb" type="number" min={1} required defaultValue={uploadMb} />
        {state.error ? <p className="text-sm text-danger">{state.error}</p> : null}
        {state.ok ? <p className="text-sm text-tide">Settings saved.</p> : null}
        <Button type="submit" disabled={pending} className="w-fit">Save settings</Button>
      </form>
      <section className="max-w-xl">
        <h2 className="font-display text-3xl italic">Invites</h2>
        <form action={inviteAction} className="mt-4 grid gap-3">
          <TextField label="Email" name="email" type="email" hint="Optional. Leave blank for a link anyone can use once." />
          {inviteState.error ? <p className="text-sm text-danger">{inviteState.error}</p> : null}
          <Button type="submit" variant="quiet" disabled={invitePending} className="w-fit">Create invite</Button>
        </form>
        <ul className="mt-4 grid gap-3">
          {invites.map((invite) => (
            <li key={invite.id} className="rounded-2xl border border-line bg-card p-3">
              <p className="break-all text-sm">{invite.url}</p>
              <p className="mt-1 text-xs text-muted">
                {invite.email ?? "Any email"} · expires {invite.expiresAt}
              </p>
              <form action={revokeInvite} className="mt-2">
                <input type="hidden" name="id" value={invite.id} />
                <button type="submit" className="text-xs text-danger">Revoke</button>
              </form>
            </li>
          ))}
        </ul>
      </section>
    </div>
  );
}
