import { Sparkles } from "lucide-react"
import { Badge } from "@/components/ui/badge"

export function BetaBadge() {
  return (
    <Badge variant="outline" className="bg-purple-500/10 text-purple-600 border-purple-500/30 font-normal">
      <Sparkles className="h-3 w-3 mr-1" />
      Beta
    </Badge>
  )
}
