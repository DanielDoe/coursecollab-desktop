import type { DeviceShot } from "@/components/landing/device-frames"

export type StudentSignupStep = "course" | "section" | "profile" | "verify"

/** Same iPhone + laptop pairing as the landing hero — one composition for the whole wizard. */
export const STUDENT_SIGNUP_DEVICE_DUO: { web: DeviceShot; phone: DeviceShot } = {
  web: {
    src: "/images/landing/web/web-cora-assistant.png",
    alt: "Cora Assistant on the web proposing a flashcard deck with a confirmation card",
    width: 1600,
    height: 1000,
  },
  phone: {
    src: "/images/landing/cora/assistant-home.png",
    alt: "Cora mobile home screen greeting a student with credits and suggested course actions",
    width: 640,
    height: 1301,
  },
}

export const STUDENT_SIGNUP_STEP_CAPTIONS: Record<StudentSignupStep, string> = {
  course: "Pick the class your instructor set up — you'll land in the right course from day one.",
  section: "Sections keep you with the right lecture group and instructor roster.",
  profile: "Use the name and ID from your syllabus so your instructor can confirm you're on the roster.",
  verify: "Verify your email, then your instructor approves — you'll sign in with your university credentials.",
}
