export default function Loading() {
  return (
    <div className="flex min-h-[60vh] items-center justify-center">
      <div className="flex flex-col items-center gap-4">
        <div className="relative">
          <div className="h-10 w-10 rounded-full border-2 border-[var(--brand-primary)]/20 border-t-[var(--brand-primary)] animate-spin" />
          <div className="absolute inset-0 h-10 w-10 rounded-full blur-lg bg-[var(--brand-primary)]/10 animate-breathe" />
        </div>
        <p className="text-sm text-[var(--text-muted)] font-medium">Loading...</p>
      </div>
    </div>
  );
}
