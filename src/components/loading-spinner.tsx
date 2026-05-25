type LoadingSpinnerProps = {
  label?: string;
  className?: string;
};

export function LoadingSpinner({ label = "Loading…", className = "" }: LoadingSpinnerProps) {
  return (
    <div className={`flex items-center justify-center gap-3 ${className}`} role="status" aria-live="polite">
      <span
        aria-hidden
        className="inline-block size-5 animate-spin rounded-full border-2 border-[color:var(--line)] border-t-[color:var(--rose)]"
      />
      <span className="font-mono text-[0.7rem] font-bold uppercase tracking-[0.18em] text-[color:var(--mauve)]">
        {label}
      </span>
    </div>
  );
}

export function LoadingScreen({ label = "Loading…" }: { label?: string }) {
  return (
    <main className="paper-noise relative min-h-screen overflow-hidden px-4 py-20 text-[color:var(--ink)] sm:px-6">
      <div className="confetti-field absolute inset-0 opacity-20" aria-hidden />
      <section className="relative z-10 mx-auto flex max-w-2xl items-center justify-center rounded-3xl border-2 border-[color:var(--line)] bg-[color:var(--champagne)] p-16 hard-shadow">
        <LoadingSpinner label={label} />
      </section>
    </main>
  );
}
