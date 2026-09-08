export default function LearningCenterLayout({
  children,
}: {
  children: React.ReactNode
}) {
  return <div className="flex min-h-0 w-full min-w-0 flex-1 flex-col overflow-x-hidden">{children}</div>
}
