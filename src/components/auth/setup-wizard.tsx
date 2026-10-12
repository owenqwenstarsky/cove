"use client";

import { useActionState, useState } from "react";
import { completeSetup } from "@/app/auth-actions";
import { AuthCard } from "@/components/status";
import { Button } from "@/components/ui/button";
import { SelectField, TextField } from "@/components/ui/field";

const steps = ["Site", "Admin", "Defaults"];

export function SetupWizard() {
  const [step, setStep] = useState(0);
  const [error, setError] = useState("");
  const [state, action, pending] = useActionState(completeSetup, {});

  function nextStep(form: HTMLFormElement) {
    const data = new FormData(form);
    if (step === 0 && String(data.get("siteName") ?? "").trim().length < 1) {
      setError("Give the site a name.");
      return;
    }
    if (step === 1) {
      const password = String(data.get("password") ?? "");
      if (String(data.get("name") ?? "").trim().length < 1 || !String(data.get("email") ?? "").includes("@")) {
        setError("Enter the admin's name and email.");
        return;
      }
      if (password.length < 8 || password !== String(data.get("confirm") ?? "")) {
        setError("Use a password of at least 8 characters, entered twice.");
        return;
      }
    }
    setError("");
    setStep((value) => value + 1);
  }

  return (
    <AuthCard eyebrow="First start" title="Set up the workspace before anyone else arrives.">
      <ol className="mb-6 flex flex-wrap gap-3 text-xs uppercase tracking-[0.16em] text-muted">
        {steps.map((label, index) => (
          <li key={label} className={index === step ? "text-copper" : undefined}>
            {index + 1}. {label}
          </li>
        ))}
      </ol>
      <form action={action} className="grid gap-4">
        <fieldset hidden={step !== 0} className="grid gap-4">
          <TextField label="Site name" name="siteName" defaultValue="Cove" required />
        </fieldset>
        <fieldset hidden={step !== 1} className="grid gap-4">
          <TextField label="Your name" name="name" autoComplete="name" required />
          <TextField label="Email" name="email" type="email" autoComplete="email" required />
          <TextField label="Password" name="password" type="password" autoComplete="new-password" required minLength={8} />
          <TextField label="Confirm password" name="confirm" type="password" autoComplete="new-password" required minLength={8} />
        </fieldset>
        <fieldset hidden={step !== 2} className="grid gap-4">
          <SelectField label="Who can join" name="registrationMode" defaultValue="closed">
            <option value="closed">Only admins create accounts</option>
            <option value="invite">Invite links</option>
            <option value="open">Anyone can sign up</option>
          </SelectField>
          <TextField label="Default storage per person (GB)" name="quotaGb" type="number" min={1} max={10000} step="1" defaultValue={15} required />
          <TextField label="Largest upload (MB)" name="uploadMb" type="number" min={1} max={2048} step="1" defaultValue={100} required />
        </fieldset>
        {error || state.error ? <p className="text-sm text-danger">{error || state.error}</p> : null}
        <div className="flex gap-2">
          {step > 0 ? (
            <Button type="button" variant="quiet" onClick={() => setStep((value) => value - 1)}>
              Back
            </Button>
          ) : null}
          {step < 2 ? (
            <Button
              type="button"
              onClick={(event) => {
                const form = event.currentTarget.form;
                if (form) nextStep(form);
              }}
            >
              Continue
            </Button>
          ) : (
            <Button type="submit" disabled={pending}>
              {pending ? "Creating…" : "Open Cove"}
            </Button>
          )}
        </div>
      </form>
    </AuthCard>
  );
}
