export type CodeBenchLanguage = 'cpp'

export type CodeBenchRunState = 'idle' | 'checking' | 'compiling' | 'running' | 'stopping'

export type DesktopCodeBenchApi = NonNullable<Window['courseCollabDesktop']>['codebench']

export type ExecutionProviderKind = 'desktop-local' | 'web-remote'

export interface ExecutionProvider {
  readonly kind: ExecutionProviderKind
}
