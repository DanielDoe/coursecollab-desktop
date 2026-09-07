/**
 * Generate a 6-8 character uppercase alphanumeric code
 * Excludes confusing characters: 0, 1, I, O
 */
export function generateFallbackCode(length: number = 6): string {
  const chars = "ABCDEFGHJKLMNPQRSTUVWXYZ23456789"; // Removes 0, 1, I, O
  let code = "";
  for (let i = 0; i < length; i++) {
    code += chars[Math.floor(Math.random() * chars.length)];
  }
  return code;
}
