"use client"

import { useId, useState } from "react"
import { cn } from "@/lib/utils"

export function ProjectFileDropzone({
  busy,
  onFiles,
}: {
  busy?: boolean
  onFiles: (files: File[]) => void
}) {
  const inputId = useId()
  const [names, setNames] = useState<string[]>([])
  const [over, setOver] = useState(false)

  const take = (list: FileList | null) => {
    const files = list ? [...list] : []
    if (!files.length || busy) return
    setNames(files.map((file) => file.name))
    onFiles(files)
  }

  return (
    <div className="mx-auto flex h-[300px] w-full max-w-[300px] flex-col items-center justify-between gap-1.5 rounded-[10px] bg-[rgba(0,110,255,0.041)] p-2.5 shadow-[4px_4px_30px_rgba(0,0,0,0.2)]">
      <label
        htmlFor={inputId}
        onDragOver={(event) => {
          event.preventDefault()
          setOver(true)
        }}
        onDragLeave={() => setOver(false)}
        onDrop={(event) => {
          event.preventDefault()
          setOver(false)
          take(event.dataTransfer.files)
        }}
        className={cn(
          "flex w-full flex-1 cursor-pointer flex-col items-center justify-center rounded-[10px] border-2 border-dashed border-[#4169e1]",
          over && "bg-[rgba(65,105,225,0.08)]",
          busy && "pointer-events-none opacity-60",
        )}
      >
        <svg viewBox="0 0 24 24" fill="none" className="h-24 w-24" aria-hidden>
          <path
            d="M7 10V9C7 6.23858 9.23858 4 12 4C14.7614 4 17 6.23858 17 9V10C19.2091 10 21 11.7909 21 14C21 15.4806 20.1956 16.8084 19 17.5M7 10C4.79086 10 3 11.7909 3 14C3 15.4806 3.8044 16.8084 5 17.5M7 10C7.43285 10 7.84965 10.0688 8.24006 10.1959M12 12V21M12 12L15 15M12 12L9 15"
            stroke="currentColor"
            className="text-[#4169e1]"
            strokeWidth="1.5"
            strokeLinecap="round"
            strokeLinejoin="round"
          />
        </svg>
        <p className="px-3 text-center text-sm text-[var(--cc-text,#111)]">
          {busy ? "Uploading…" : "Browse files to upload"}
        </p>
      </label>
      <div className="flex h-10 w-full items-center justify-end gap-1 rounded-[10px] bg-[rgba(0,110,255,0.075)] px-2 text-[var(--cc-text,#111)]">
        <svg viewBox="0 0 32 32" className="h-6 w-6 shrink-0 fill-[#4169e1]" aria-hidden>
          <path d="M15.331 6H8.5v20h15V14.154h-8.169z" />
          <path d="M18.153 6h-.009v5.342H23.5v-.002z" />
        </svg>
        <p className="min-w-0 flex-1 truncate text-center text-xs">
          {names.length === 0 ? "No file selected" : names.length === 1 ? names[0] : `${names.length} files selected`}
        </p>
        <button
          type="button"
          aria-label="Clear selected files"
          className="grid h-7 w-7 place-items-center rounded-full bg-black/10 text-[#4169e1]"
          onClick={() => setNames([])}
        >
          <svg viewBox="0 0 24 24" fill="none" className="h-4 w-4" aria-hidden>
            <path d="M5.16565 10.1534C5.07629 8.99181 5.99473 8 7.15975 8H16.8402C18.0053 8 18.9237 8.9918 18.8344 10.1534L18.142 19.1534C18.0619 20.1954 17.193 21 16.1479 21H7.85206C6.80699 21 5.93811 20.1954 5.85795 19.1534L5.16565 10.1534Z" stroke="currentColor" strokeWidth="2" />
            <path d="M19.5 5H4.5" stroke="currentColor" strokeWidth="2" strokeLinecap="round" />
            <path d="M10 3C10 2.44772 10.4477 2 11 2H13C13.5523 2 14 2.44772 14 3V5H10V3Z" stroke="currentColor" strokeWidth="2" />
          </svg>
        </button>
      </div>
      <input
        id={inputId}
        type="file"
        multiple
        className="hidden"
        disabled={busy}
        onChange={(event) => {
          take(event.target.files)
          event.target.value = ""
        }}
      />
    </div>
  )
}
