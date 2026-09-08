export default function ManagementLayout({
  children,
}: {
  children: React.ReactNode
}) {
  return (
    <div className="flex min-h-0 w-full min-w-0 flex-1 flex-col gap-4 overflow-x-hidden sm:gap-6">
      {children}
    </div>
  )
}
