interface TableSkeletonProps {
  title?: string
  subtitle?: string
  columns?: number
  rows?: number
  showToolbar?: boolean
}

export function TableSkeleton({
  title,
  subtitle,
  columns = 6,
  rows = 8,
  showToolbar = true,
}: TableSkeletonProps) {
  const cols = Array.from({ length: columns }, (_, i) => i)
  const rowsArr = Array.from({ length: rows }, (_, i) => i)
  const gridStyle = { gridTemplateColumns: `repeat(${columns}, minmax(0, 1fr))` }

  return (
    <div className="space-y-6 animate-fade-in">
      {(title || subtitle) && (
        <div>
          {title && (
            <div className="h-9 w-48 bg-neutral-200 dark:bg-neutral-700 rounded-[var(--radius-md)] animate-skeleton" />
          )}
          {subtitle && (
            <div className="h-5 w-72 bg-neutral-100 dark:bg-neutral-800 rounded-[var(--radius-md)] animate-skeleton mt-2" />
          )}
        </div>
      )}

      {showToolbar && (
        <div className="flex items-center justify-between gap-3">
          <div className="flex items-center gap-2 flex-1">
            <div className="h-10 flex-1 max-w-md bg-neutral-100 dark:bg-neutral-800 rounded-[var(--radius-md)] animate-skeleton" />
            <div className="h-10 w-10 bg-neutral-100 dark:bg-neutral-800 rounded-[var(--radius-md)] animate-skeleton" />
          </div>
          <div className="h-10 w-36 bg-primary-100 dark:bg-primary-900/30 rounded-[var(--radius-md)] animate-skeleton" />
        </div>
      )}

      <div className="bg-white dark:bg-neutral-800 border border-neutral-200 dark:border-neutral-700 rounded-[var(--radius-lg)] overflow-hidden shadow-xs">
        <div
          className="grid gap-4 px-4 py-3 bg-neutral-50 dark:bg-neutral-800/50 border-b border-neutral-200 dark:border-neutral-700"
          style={gridStyle}
        >
          {cols.map((i) => (
            <div
              key={i}
              className="h-4 bg-neutral-200 dark:bg-neutral-700 rounded animate-skeleton"
              style={{ animationDelay: `${i * 50}ms` }}
            />
          ))}
        </div>

        {rowsArr.map((row) => (
          <div
            key={row}
            className="grid gap-4 px-4 py-4 border-b border-neutral-100 dark:border-neutral-700 last:border-0"
            style={gridStyle}
          >
            {cols.map((i) => (
              <div key={i} className="flex items-center">
                <div
                  className="h-4 w-full bg-neutral-100 dark:bg-neutral-700 rounded animate-skeleton"
                  style={{ animationDelay: `${row * 80}ms` }}
                />
              </div>
            ))}
          </div>
        ))}
      </div>
    </div>
  )
}

interface FormSkeletonProps {
  title?: string
  fields?: number
}

export function FormSkeleton({ title, fields = 5 }: FormSkeletonProps) {
  const fieldsArr = Array.from({ length: fields }, (_, i) => i)

  return (
    <div className="space-y-6 animate-fade-in max-w-2xl">
      {title && (
        <div className="h-9 w-56 bg-neutral-200 dark:bg-neutral-700 rounded-[var(--radius-md)] animate-skeleton" />
      )}

      <div className="bg-white dark:bg-neutral-800 border border-neutral-200 dark:border-neutral-700 rounded-[var(--radius-lg)] p-6 space-y-5 shadow-xs">
        {fieldsArr.map((i) => (
          <div key={i} className="space-y-2">
            <div
              className="h-4 w-32 bg-neutral-200 dark:bg-neutral-700 rounded animate-skeleton"
              style={{ animationDelay: `${i * 50}ms` }}
            />
            <div
              className="h-10 w-full bg-neutral-100 dark:bg-neutral-800 rounded-[var(--radius-md)] animate-skeleton"
              style={{ animationDelay: `${i * 50}ms` }}
            />
          </div>
        ))}

        <div className="flex justify-end gap-2 pt-2">
          <div className="h-10 w-24 bg-neutral-100 dark:bg-neutral-800 rounded-[var(--radius-md)] animate-skeleton" />
          <div className="h-10 w-32 bg-primary-100 dark:bg-primary-900/30 rounded-[var(--radius-md)] animate-skeleton" />
        </div>
      </div>
    </div>
  )
}

interface DetailSkeletonProps {
  sections?: number
}

export function DetailSkeleton({ sections = 2 }: DetailSkeletonProps) {
  const sectionsArr = Array.from({ length: sections }, (_, i) => i)

  return (
    <div className="space-y-6 animate-fade-in">
      <div className="flex items-start justify-between gap-4">
        <div>
          <div className="h-9 w-64 bg-neutral-200 dark:bg-neutral-700 rounded-[var(--radius-md)] animate-skeleton" />
          <div className="h-5 w-40 bg-neutral-100 dark:bg-neutral-800 rounded-[var(--radius-md)] animate-skeleton mt-2" />
        </div>
        <div className="h-10 w-32 bg-neutral-100 dark:bg-neutral-800 rounded-[var(--radius-md)] animate-skeleton" />
      </div>

      {sectionsArr.map((s) => (
        <div
          key={s}
          className="bg-white dark:bg-neutral-800 border border-neutral-200 dark:border-neutral-700 rounded-[var(--radius-lg)] p-6 space-y-3 shadow-xs"
        >
          <div
            className="h-5 w-40 bg-neutral-200 dark:bg-neutral-700 rounded animate-skeleton"
            style={{ animationDelay: `${s * 80}ms` }}
          />
          <div className="h-4 w-full bg-neutral-100 dark:bg-neutral-700 rounded animate-skeleton" />
          <div className="h-4 w-5/6 bg-neutral-100 dark:bg-neutral-700 rounded animate-skeleton" />
          <div className="h-4 w-2/3 bg-neutral-100 dark:bg-neutral-700 rounded animate-skeleton" />
        </div>
      ))}
    </div>
  )
}
