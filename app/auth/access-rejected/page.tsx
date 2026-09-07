import { AccessRequestStatusScreen } from "@/components/auth/AccessRequestStatusScreen"

export default function AccessRejectedPage() {
  return (
    <AccessRequestStatusScreen
      allowedLifecycles={["rejected", "suspended", "deactivated"]}
    />
  )
}
