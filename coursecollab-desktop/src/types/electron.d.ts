export {}

declare global {
  interface Window {
    courseCollabDesktop: {
      getAppVersion: () => Promise<string>
    }
  }
}
