import { CcBookLoader } from "@/components/ui/cc-book-loader"

function Spinner({
  className,
  size = "default",
}: {
  className?: string
  size?: "sm" | "default" | "lg"
}) {
  const bookSize = size === "lg" ? "lg" : size === "sm" ? "xs" : "sm"
  return <CcBookLoader size={bookSize} className={className} />
}

function SpinnerRing({
  className,
  size = "default",
}: {
  className?: string
  size?: "sm" | "default" | "lg"
}) {
  const bookSize = size === "lg" ? "lg" : size === "sm" ? "xs" : "sm"
  return <CcBookLoader size={bookSize} className={className} />
}

export { Spinner, SpinnerRing }
