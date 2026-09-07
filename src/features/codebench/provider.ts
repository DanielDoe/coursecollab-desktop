import type { ExecutionProvider } from './types/codebench'

/** Desktop talks to the main-process runner through preload. Web remote is future work. */
export class DesktopLocalProvider implements ExecutionProvider {
  readonly kind = 'desktop-local' as const
}

export class WebRemoteProvider implements ExecutionProvider {
  readonly kind = 'web-remote' as const
}

export function resolveExecutionProvider(): ExecutionProvider {
  if (typeof window !== 'undefined' && window.courseCollabDesktop?.codebench) {
    return new DesktopLocalProvider()
  }
  return new WebRemoteProvider()
}
