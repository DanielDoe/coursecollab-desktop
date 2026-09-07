export default function SettingsLayout({
  children,
}: {
  children: React.ReactNode
}) {
  return (
    <div className="w-full min-w-0 overflow-x-hidden">
      {children}
    </div>
  )
}
