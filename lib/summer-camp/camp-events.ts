export const CAMP_XP_UPDATED_EVENT = "camp-xp-updated"

export function notifyCampXpUpdated() {
  if (typeof window !== "undefined") {
    window.dispatchEvent(new CustomEvent(CAMP_XP_UPDATED_EVENT))
  }
}
