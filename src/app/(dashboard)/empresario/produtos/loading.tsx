export default function ProdutosLoading() {
  return (
    <div className="space-y-6 animate-fade-in">
      <div>
        <div className="h-9 w-48 bg-neutral-200 dark:bg-neutral-700 rounded-[var(--radius-md)] animate-skeleton" />
        <div className="h-5 w-72 bg-neutral-100 dark:bg-neutral-800 rounded-[var(--radius-md)] animate-skeleton mt-2" />
      </div>

      {/* Toolbar skeleton */}
      <div className="flex items-center justify-between gap-3">
        <div className="flex items-center gap-2 flex-1">
          <div className="h-10 flex-1 max-w-md bg-neutral-100 dark:bg-neutral-800 rounded-[var(--radius-md)] animate-skeleton" />
          <div className="h-10 w-10 bg-neutral-100 dark:bg-neutral-800 rounded-[var(--radius-md)] animate-skeleton" />
        </div>
        <div className="h-10 w-36 bg-primary-100 dark:bg-primary-900/30 rounded-[var(--radius-md)] animate-skeleton" />
      </div>

      {/* Table skeleton */}
      <div className="bg-white dark:bg-neutral-800 border border-neutral-200 dark:border-neutral-700 rounded-[var(--radius-lg)] overflow-hidden shadow-xs">
        {/* Header */}
        <div className="grid grid-cols-8 gap-4 px-4 py-3 bg-neutral-50 dark:bg-neutral-800/50 border-b border-neutral-200 dark:border-neutral-700">
          {[1, 2, 3, 4, 5, 6, 7, 8].map((i) => (
            <div
              key={i}
              className="h-4 bg-neutral-200 dark:bg-neutral-700 rounded animate-skeleton"
              style={{ animationDelay: `${i * 50}ms` }}
            />
          ))}
        </div>

        {/* Rows */}
        {[1, 2, 3, 4, 5, 6, 7, 8].map((row) => (
          <div
            key={row}
            className="grid grid-cols-8 gap-4 px-4 py-4 border-b border-neutral-100 dark:border-neutral-700 last:border-0"
          >
            <div className="flex items-center">
              <div className="h-4 w-4 bg-neutral-100 dark:bg-neutral-700 rounded animate-skeleton" />
            </div>
            <div className="flex items-center">
              <div className="h-10 w-10 bg-neutral-100 dark:bg-neutral-700 rounded-[var(--radius-md)] animate-skeleton" />
            </div>
            <div className="flex items-center">
              <div
                className="h-4 w-full bg-neutral-100 dark:bg-neutral-700 rounded animate-skeleton"
                style={{ animationDelay: `${row * 80}ms` }}
              />
            </div>
            <div className="flex items-center">
              <div className="h-4 w-24 bg-neutral-100 dark:bg-neutral-700 rounded animate-skeleton" />
            </div>
            <div className="flex items-center">
              <div className="h-5 w-16 bg-primary-50 dark:bg-primary-900/20 rounded-full animate-skeleton" />
            </div>
            <div className="flex flex-col gap-1 justify-center">
              <div className="h-4 w-20 bg-success-50 dark:bg-success-900/20 rounded animate-skeleton" />
              <div className="h-3 w-24 bg-neutral-100 dark:bg-neutral-700 rounded animate-skeleton" />
            </div>
            <div className="flex items-center">
              <div className="h-4 w-20 bg-neutral-100 dark:bg-neutral-700 rounded animate-skeleton" />
            </div>
            <div className="flex items-center gap-1">
              <div className="h-7 w-7 bg-neutral-100 dark:bg-neutral-700 rounded-[var(--radius-md)] animate-skeleton" />
              <div className="h-7 w-7 bg-neutral-100 dark:bg-neutral-700 rounded-[var(--radius-md)] animate-skeleton" />
            </div>
          </div>
        ))}
      </div>
    </div>
  );
}
