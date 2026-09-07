import { appendNativeAppQuery } from "@/lib/mobile-native-app"

export function notesNativePath(path: string, native: boolean): string {
  return native ? appendNativeAppQuery(path) : path
}
