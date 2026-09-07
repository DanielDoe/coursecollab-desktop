export default function ContentLayout({
  children,
}: {
  children: React.ReactNode
}) {
  return <div className="space-y-4 sm:space-y-6 w-full min-w-0 overflow-x-hidden">{children}</div>
}
