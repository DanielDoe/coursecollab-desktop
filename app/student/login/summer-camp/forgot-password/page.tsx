import { DesktopAuthShell } from "@/components/auth/DesktopAuthShell"
import {
  DesktopAuthPanel,
  DesktopAuthPanelBody,
  DesktopAuthPanelCard,
} from "@/components/auth/desktop-auth-primitives"
import { SummerCamperForgotPasswordForm } from "@/components/summer-camp/SummerCamperForgotPasswordForm"

export default function SummerCamperForgotPasswordPage() {
  return (
    <DesktopAuthShell sidebarTagline="Recover access to your Summer Camp account.">
      <DesktopAuthPanel>
        <DesktopAuthPanelBody>
          <DesktopAuthPanelCard>
            <SummerCamperForgotPasswordForm />
          </DesktopAuthPanelCard>
        </DesktopAuthPanelBody>
      </DesktopAuthPanel>
    </DesktopAuthShell>
  )
}
