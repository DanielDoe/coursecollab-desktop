"use client"

/**
 * Re-export the canonical toast store from `hooks/use-toast` so any import of
 * `@/components/ui/use-toast` shares the same state as `<Toaster />`, which
 * reads from `@/hooks/use-toast`. Previously these were two separate stores,
 * so calls to `toast()` from many components never rendered.
 */
export { useToast, toast } from "@/hooks/use-toast"
