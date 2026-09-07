/** Notify the Expo/Capacitor shell to refresh membership, points, and notifications. */
export function notifyNativeRefreshStudentData(): void {
  if (typeof window === "undefined") return
  const bridge = (window as Window & { ReactNativeWebView?: { postMessage: (value: string) => void } })
    .ReactNativeWebView
  bridge?.postMessage(JSON.stringify({ type: "REFRESH_STUDENT_DATA" }))
}

/** Ask the native shell to navigate to an in-app route (e.g. `/membership`, `/dashboard`). */
export function notifyNativeNavigate(route: string): void {
  if (typeof window === "undefined") return
  const bridge = (window as Window & { ReactNativeWebView?: { postMessage: (value: string) => void } })
    .ReactNativeWebView
  bridge?.postMessage(JSON.stringify({ type: "NATIVE_NAVIGATE", route }))
}
