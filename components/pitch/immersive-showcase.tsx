"use client"

import { useEffect, useRef, type ReactNode } from "react"
import Image from "next/image"
import { ArrowLeft, type LucideIcon } from "lucide-react"
import { DeviceDuo, type DeviceShot } from "@/components/landing/device-frames"
import { usePitchFocus } from "@/components/pitch/pitch-focus"
import { Thesis } from "@/components/pitch/pitch-ui"
import { cn } from "@/lib/utils"

export type ImmersiveItem = {
  id: string
  title: string
  line: string
  detail: string
  points: string[]
  icon: LucideIcon
  web: DeviceShot
  phone: DeviceShot
}

export function ImmersiveShowcase({
  items,
  thesis,
  backLabel = "All",
  columns = 3,
  active,
  onChange,
}: {
  items: ImmersiveItem[]
  thesis?: ReactNode
  backLabel?: string
  columns?: 2 | 3
  active: string | null
  onChange: (id: string | null) => void
}) {
  const selected = items.find((item) => item.id === active) ?? null
  const focus = usePitchFocus()
  const itemsRef = useRef(items)
  const activeRef = useRef(active)
  itemsRef.current = items
  activeRef.current = active

  useEffect(() => {
    if (!focus) return
    if (!active) {
      focus.setHandler(null)
      return
    }
    focus.setHandler((e) => {
      const list = itemsRef.current
      const current = activeRef.current
      const index = list.findIndex((item) => item.id === current)
      if (e.key === "Escape") {
        onChange(null)
        return true
      }
      if (["ArrowRight", "ArrowDown", "PageDown", " ", "Enter"].includes(e.key)) {
        onChange(list[(index + 1) % list.length]?.id ?? null)
        return true
      }
      if (["ArrowLeft", "ArrowUp", "PageUp", "Backspace"].includes(e.key)) {
        onChange(list[(index - 1 + list.length) % list.length]?.id ?? null)
        return true
      }
      return false
    })
    return () => focus.setHandler(null)
  }, [active, focus, onChange])

  return (
    <div className="relative flex min-h-0 flex-1 flex-col" onClick={(e) => e.stopPropagation()}>
      {selected ? (
        <ExpandedView
          items={items}
          selected={selected}
          backLabel={backLabel}
          onBack={() => onChange(null)}
          onPick={onChange}
        />
      ) : (
        <GridView items={items} columns={columns} thesis={thesis} onPick={onChange} />
      )}
    </div>
  )
}

function GridView({
  items,
  columns,
  thesis,
  onPick,
}: {
  items: ImmersiveItem[]
  columns: 2 | 3
  thesis?: ReactNode
  onPick: (id: string) => void
}) {
  return (
    <div className="flex min-h-0 flex-1 flex-col">
      <div
        className={cn(
          "grid min-h-0 flex-1 gap-3",
          columns === 2 ? "grid-cols-1 sm:grid-cols-2" : "grid-cols-1 sm:grid-cols-2 lg:grid-cols-3",
        )}
      >
        {items.map((item, i) => (
          <button
            key={item.id}
            type="button"
            onClick={() => onPick(item.id)}
            style={{ animationDelay: `${40 + i * 55}ms` }}
            className="pitch-rise pitch-card-shine group relative flex min-h-0 flex-col overflow-hidden rounded-2xl border border-white/10 bg-white/[0.03] text-left transition duration-300 hover:-translate-y-1 hover:border-[#EAAA00]/50 hover:bg-white/[0.055] hover:shadow-[0_18px_40px_-24px_rgba(234,170,0,0.55)]"
          >
            <div className="relative aspect-[16/9] overflow-hidden bg-[#120c1c]">
              <Image
                src={item.web.src}
                alt={item.web.alt}
                fill
                className="pitch-ken object-cover object-top transition duration-500 group-hover:scale-[1.04]"
                sizes={columns === 2 ? "42vw" : "30vw"}
              />
              <div className="pointer-events-none absolute inset-0 bg-gradient-to-t from-[#09060f]/80 via-transparent to-transparent" />
              <div className="absolute bottom-[-6%] right-[4%] w-[26%] rotate-[-8deg] drop-shadow-[0_10px_18px_rgba(0,0,0,0.45)] transition duration-500 group-hover:-translate-y-1 group-hover:rotate-[-4deg]">
                <Image
                  src={item.phone.src}
                  alt=""
                  width={item.phone.width}
                  height={item.phone.height}
                  className="h-auto w-full"
                  sizes="10vw"
                />
              </div>
            </div>
            <div className="flex flex-1 flex-col p-3.5">
              <div className="mb-1.5 flex items-center justify-between">
                <item.icon className="h-3.5 w-3.5 text-[#EAAA00]" />
                <span className="text-[13px] font-semibold uppercase tracking-[0.16em] text-[#EAAA00]/70">
                  Explore
                </span>
              </div>
              <p className="text-base font-semibold text-white sm:text-[18px]">{item.title}</p>
              <p className="mt-1 text-sm leading-snug text-white/50 sm:text-[15px]">{item.line}</p>
            </div>
          </button>
        ))}
      </div>
      {thesis ? <Thesis>{thesis}</Thesis> : null}
    </div>
  )
}

function ExpandedView({
  items,
  selected,
  backLabel,
  onBack,
  onPick,
}: {
  items: ImmersiveItem[]
  selected: ImmersiveItem
  backLabel: string
  onBack: () => void
  onPick: (id: string) => void
}) {
  return (
    <div key={selected.id} className="pitch-enter flex min-h-0 flex-1 flex-col">
      <div className="-mx-1 mb-3 flex items-center gap-2 overflow-x-auto overscroll-x-contain pb-1">
        <button
          type="button"
          onClick={onBack}
          className="inline-flex shrink-0 items-center gap-1.5 rounded-full border border-white/15 bg-white/5 px-3 py-1.5 text-sm font-semibold text-white/75 transition hover:bg-white/10 sm:px-3.5 sm:text-[15px]"
        >
          <ArrowLeft className="h-3.5 w-3.5" />
          {backLabel}
        </button>
        {items.map((item) => (
          <button
            key={item.id}
            type="button"
            onClick={() => onPick(item.id)}
            className={cn(
              "shrink-0 rounded-full px-3 py-1.5 text-sm font-semibold transition sm:px-3.5 sm:text-[15px]",
              item.id === selected.id
                ? "bg-[#EAAA00] text-[#1e1033]"
                : "border border-white/10 text-white/45 hover:border-white/25 hover:text-white",
            )}
          >
            {item.title}
          </button>
        ))}
      </div>

      <div className="relative grid min-h-0 flex-1 grid-cols-1 items-start gap-4 sm:gap-6 xl:grid-cols-[minmax(0,1.2fr)_minmax(0,0.8fr)] xl:items-center">
        <div className="pitch-orb pointer-events-none absolute left-[18%] top-[8%] hidden h-56 w-56 rounded-full bg-[#EAAA00]/12 blur-3xl xl:block" />
        <div className="pitch-orb pointer-events-none absolute bottom-[10%] right-[8%] hidden h-40 w-40 rounded-full bg-[#582c83]/40 blur-3xl [animation-delay:-3s] xl:block" />
        <div className="relative min-w-0 overflow-hidden">
          <DeviceDuo
            web={selected.web}
            phone={selected.phone}
            webSizes="(max-width: 640px) 88vw, (max-width: 1280px) 88vw, 50vw"
            phoneSizes="(max-width: 640px) 20vw, (max-width: 1280px) 20vw, 14vw"
            className="max-w-full"
          />
        </div>
        <div className="relative min-w-0 pb-2">
          <p className="text-xs font-semibold uppercase tracking-[0.2em] text-[#EAAA00] sm:text-[14px]">
            {selected.line}
          </p>
          <h3
            className="mt-1.5 font-sans text-xl font-extrabold tracking-tight text-white sm:mt-2 sm:text-2xl lg:text-3xl"
            style={{ animationDelay: "60ms" }}
          >
            {selected.title}
          </h3>
          <p className="mt-2 text-[15px] leading-relaxed text-white/72 sm:mt-3 sm:text-[17px] lg:text-[18px]">
            {selected.detail}
          </p>
          <ul className="mt-3 space-y-2 sm:mt-5 sm:space-y-2.5">
            {selected.points.map((point, i) => (
              <li
                key={point}
                className="pitch-rise flex items-start text-[15px] text-white/82 sm:text-[17px] lg:text-[18px]"
                style={{ animationDelay: `${90 + i * 55}ms` }}
              >
                <span
                  className="mt-1.5 mr-2.5 inline-block h-1.5 w-1.5 shrink-0 rounded-full bg-[#EAAA00]"
                  style={{ boxShadow: "0 0 10px #EAAA00" }}
                />
                {point}
              </li>
            ))}
          </ul>
        </div>
      </div>
    </div>
  )
}
