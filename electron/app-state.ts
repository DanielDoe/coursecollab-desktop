let appQuitting = false

export function setAppQuitting(value: boolean) {
  appQuitting = value
}

export function isAppQuitting() {
  return appQuitting
}
