export const LANDING_CONTACT_EMAIL = "danieldoe33@gmail.com"

/** Demo / quote / pilot alerts until support@ is provisioned. */
export const INSTITUTION_SALES_NOTIFY_EMAIL = "danieldoe33@gmail.com"

export const landingMailto = (subject: string) =>
  `mailto:${LANDING_CONTACT_EMAIL}?subject=${encodeURIComponent(subject)}`
