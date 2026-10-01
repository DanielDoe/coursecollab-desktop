/**
 * iPhone paste from Photos or Messages often inserts a local path as text:
 * file:///var/mobile/Library/SMS/Attachments/.../Screenshot.png
 * That path only exists on the sender's phone, so it cannot be shown as an image.
 */

export const LOCAL_DEVICE_FILE_PASTE_ERROR =
  "iPhone pasted a link, not the photo. Choose it from your library."

export function plainTextHasLocalDeviceFileUrl(text: string): boolean {
  return /file:\/\/\//i.test(text)
}

/** Message text is only a phone-local file path, optionally followed by a short name. */
export function messageIsOnlyLocalDeviceFile(plain: string): boolean {
  const text = plain.replace(/\u00a0/g, " ").trim()
  if (!plainTextHasLocalDeviceFileUrl(text)) return false
  const leftover = text.replace(/file:\/\/\/\S+/gi, " ").replace(/\s+/g, " ").trim()
  if (!leftover) return true
  const words = leftover.split(" ")
  return words.length <= 5 && leftover.length <= 80 && !/[.!?…]/.test(leftover)
}
