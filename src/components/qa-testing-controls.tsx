"use client";

import { useFormStatus } from "react-dom";
import { resetTestAccounts } from "@/app/login/actions";

export function QaSubmitButton({
  label,
  pendingLabel,
  variant = "primary",
}: {
  label: string;
  pendingLabel: string;
  variant?: "primary" | "secondary" | "danger";
}) {
  const { pending } = useFormStatus();
  const variantClass =
    variant === "primary"
      ? "ck-btn--primary"
      : variant === "danger"
        ? "ck-btn--danger"
        : "ck-btn--secondary";

  return (
    <button
      type="submit"
      disabled={pending}
      aria-busy={pending || undefined}
      className={`ck-btn ck-btn--sm whitespace-nowrap ${variantClass} ${pending ? "opacity-70" : ""}`}
    >
      {pending ? pendingLabel : label}
    </button>
  );
}

export function QaGlobalResetForm() {
  return (
    <form
      action={resetTestAccounts}
      onSubmit={(event) => {
        const confirmed = window.confirm(
          "Reset every seeded test account and QA event? Work in all test scenarios will be removed. Real accounts are not affected.",
        );
        if (!confirmed) event.preventDefault();
      }}
    >
      <QaSubmitButton
        label="Reset all test data"
        pendingLabel="Resetting all test data..."
        variant="danger"
      />
    </form>
  );
}
