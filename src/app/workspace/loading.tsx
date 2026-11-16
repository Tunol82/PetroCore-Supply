export default function WorkspaceLoading() {
  return (
    <div className="space-y-6" aria-busy="true">
      <div className="space-y-2">
        <div className="h-3 w-24 animate-pulse rounded bg-[var(--surface-3)]" />
        <div className="h-7 w-56 animate-pulse rounded bg-[var(--surface-3)]" />
        <div className="h-3 w-72 animate-pulse rounded bg-[var(--surface-3)]" />
      </div>

      <div className="grid gap-4 sm:grid-cols-3">
        {[0, 1, 2].map((index) => (
          <div
            key={index}
            className="h-24 animate-pulse rounded-[var(--radius)] border border-[var(--line)] bg-[var(--surface)]"
          />
        ))}
      </div>

      <div className="grid gap-3 sm:grid-cols-2 xl:grid-cols-3">
        {[0, 1, 2, 3, 4, 5].map((index) => (
          <div
            key={index}
            className="h-24 animate-pulse rounded-[var(--radius)] border border-[var(--line)] bg-[var(--surface)]"
          />
        ))}
      </div>

      <span className="sr-only">Loading workspace</span>
    </div>
  );
}
