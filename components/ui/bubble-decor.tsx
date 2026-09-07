/** Soft floating bubbles used by dashboard KPI / Cora capability cards. */
export function BubbleDecor({ color }: { color: string }) {
  return (
    <div className="pointer-events-none absolute inset-0 overflow-hidden rounded-[inherit]" aria-hidden>
      <span
        className="absolute -right-4 -top-5 size-[4.5rem] rounded-full opacity-[0.16] sm:size-20"
        style={{ backgroundColor: color }}
      />
      <span
        className="absolute -bottom-6 -left-3 size-[5.5rem] rounded-full opacity-[0.11] sm:size-24"
        style={{ backgroundColor: color }}
      />
      <span
        className="absolute right-[38%] top-2 size-3 rounded-full opacity-[0.2]"
        style={{ backgroundColor: color }}
      />
      <span
        className="absolute bottom-3 right-14 size-2 rounded-full opacity-[0.14]"
        style={{ backgroundColor: color }}
      />
    </div>
  )
}
