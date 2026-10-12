"use client";

import { useActionState, useEffect, useState } from "react";
import { useRouter } from "next/navigation";
import { createAccount, updateAccount } from "@/app/admin/actions";
import { Button } from "@/components/ui/button";
import { SelectField, TextField } from "@/components/ui/field";
import { Modal } from "@/components/ui/modal";
import { formatBytes } from "@/lib/format";

export type Person = {
  id: string;
  name: string;
  email: string;
  role: "ADMIN" | "USER";
  disabled: boolean;
  quotaGb: string;
  usedBytes: number;
};

export function PeopleManager({ people }: { people: Person[] }) {
  const [open, setOpen] = useState(false);
  const [state, action, pending] = useActionState(createAccount, {});
  const router = useRouter();
  useEffect(() => {
    if (state.ok) router.refresh();
  }, [state.ok, router]);
  return (
    <div>
      <div className="flex items-center justify-between gap-3">
        <h1 className="font-display text-4xl italic">People</h1>
        <Button type="button" onClick={() => setOpen(true)}>Add person</Button>
      </div>
      <ul className="mt-8 grid gap-4">
        {people.map((person) => (
          <li key={person.id} className="rounded-3xl border border-line bg-card p-4">
            <PersonForm person={person} />
          </li>
        ))}
      </ul>
      <Modal open={open} title="Add person" onClose={() => setOpen(false)}>
        <form action={action} className="grid gap-3">
          <TextField label="Name" name="name" required />
          <TextField label="Email" name="email" type="email" required />
          <TextField label="Password" name="password" type="password" required minLength={8} />
          <SelectField label="Role" name="role" defaultValue="USER">
            <option value="USER">User</option>
            <option value="ADMIN">Admin</option>
          </SelectField>
          <TextField label="Quota in GB" name="quotaGb" type="number" min={1} hint="Leave blank to use the site default." />
          {state.error ? <p className="text-sm text-danger">{state.error}</p> : null}
          {state.ok ? <p className="text-sm text-tide">Account created.</p> : null}
          <Button type="submit" disabled={pending}>Create account</Button>
        </form>
      </Modal>
    </div>
  );
}

function PersonForm({ person }: { person: Person }) {
  const [state, action, pending] = useActionState(updateAccount, {});
  return (
    <form action={action} className="grid gap-3">
      <input type="hidden" name="id" value={person.id} />
      <div>
        <p className="font-medium">{person.name}</p>
        <p className="text-sm text-muted">{person.email}</p>
        <p className="text-xs text-muted">{formatBytes(person.usedBytes)} used</p>
      </div>
      <div className="grid gap-3 sm:grid-cols-3">
        <SelectField label="Role" name="role" defaultValue={person.role}>
          <option value="USER">User</option>
          <option value="ADMIN">Admin</option>
        </SelectField>
        <TextField label="Quota in GB" name="quotaGb" type="number" min={1} defaultValue={person.quotaGb} hint="Blank uses the site default." />
        <TextField label="New password" name="password" type="password" autoComplete="new-password" hint="Leave blank to keep the current password." />
      </div>
      <label className="flex items-center gap-2 text-sm">
        <input type="checkbox" name="disabled" defaultChecked={person.disabled} />
        Disabled
      </label>
      {state.error ? <p className="text-sm text-danger">{state.error}</p> : null}
      {state.ok ? <p className="text-sm text-tide">Saved.</p> : null}
      <Button type="submit" variant="quiet" disabled={pending} className="w-fit">
        Save account
      </Button>
    </form>
  );
}
