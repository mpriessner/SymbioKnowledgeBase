export function EmptyState() {
  return (
    <div className="text-center py-12">
      <div className="text-6xl mb-4">{"\u{1F4EC}"}</div>
      <h2 className="text-xl font-semibold text-[var(--text-primary)] mb-2">
        No notifications yet
      </h2>
      <p className="text-[var(--text-secondary)]">
        You&apos;ll see updates about page mentions, edits, and agent activity
        here.
      </p>
    </div>
  );
}
