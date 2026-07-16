type LoadingSpinnerProps = {
  label?: string;
  className?: string;
};

export function LoadingSpinner({ label = "Loading…", className = "" }: LoadingSpinnerProps) {
  return (
    <div className={`flex items-center justify-center gap-3 ${className}`} role="status" aria-live="polite">
      <span
        aria-hidden
        // border-2 here is the spinner ring stroke, not a box border.
        className="inline-block size-5 animate-spin rounded-full border-2 border-[color:var(--mist)] border-t-[color:var(--purple)]"
      />
      <span className="text-[12.5px] font-semibold text-[color:var(--slate)]">{label}</span>
    </div>
  );
}

export function LoadingScreen({ label = "Loading…" }: { label?: string }) {
  return (
    <main className="min-h-screen bg-[color:var(--champagne)] px-4 py-20 text-[color:var(--ink)] sm:px-6">
      <section className="mx-auto flex max-w-2xl items-center justify-center rounded-[var(--radius-xl)] bg-[color:var(--paper)] p-16 shadow-[var(--shadow-sm)]">
        <LoadingSpinner label={label} />
      </section>
    </main>
  );
}
