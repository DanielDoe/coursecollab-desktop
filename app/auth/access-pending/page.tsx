import { AccessRequestStatusScreen } from "@/components/auth/AccessRequestStatusScreen"

export default function AccessPendingPage() {
  return (
    <AccessRequestStatusScreen
      allowedLifecycles={["pending_approval", "pending_email_verification"]}
    />
  )
}
