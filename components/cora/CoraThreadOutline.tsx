"use client"

type Item = { id: string; label: string }

export function CoraThreadOutline({
  items,
  onSelect,
}: {
  items: Item[]
  onSelect: (id: string) => void
}) {
  if (items.length < 3) return null

  return (
    <nav
      aria-label="Prompts in this chat"
      className="sticky top-3 hidden h-fit w-36 shrink-0 lg:block"
    >
      <p className="px-1.5 text-[10px] font-medium uppercase tracking-wide text-[var(--cc-text-muted)]">
        Prompts
      </p>
      <ol className="mt-1 max-h-[50vh] space-y-0.5 overflow-y-auto">
        {items.map((item, index) => (
          <li key={item.id}>
            <button
              type="button"
              title={item.label}
              className="w-full truncate rounded-md px-1.5 py-1 text-left text-[11px] text-[var(--cc-text-muted)] hover:bg-[var(--muted)] hover:text-[var(--cc-text)]"
              onClick={() => onSelect(item.id)}
            >
              {index + 1}. {item.label}
            </button>
          </li>
        ))}
      </ol>
    </nav>
  )
}
