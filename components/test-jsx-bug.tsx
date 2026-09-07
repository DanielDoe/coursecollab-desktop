"use client"

export function TestJsxBug() {
  const loading = false
  if (loading) {
    return <div>Loading</div>
  }
  return (
    <div className="test">Content</div>
  )
}
