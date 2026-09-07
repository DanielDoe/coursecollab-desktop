import { codeBenchProcessManager } from './processManager'
import { detectCppCompiler } from './compilerDetector'
import { canLoadNodePty } from './processRunner'
import { cleanupAllSessions } from './workspace'
import type { CodeBenchEvent, CodeBenchEventSink } from './types'

type Collected = {
  events: CodeBenchEvent[]
  output: string
}

function createSink(): { sink: CodeBenchEventSink; collected: Collected; waitFor: (predicate: (event: CodeBenchEvent) => boolean, timeoutMs?: number) => Promise<CodeBenchEvent> } {
  const collected: Collected = { events: [], output: '' }
  const waiters: Array<{ predicate: (event: CodeBenchEvent) => boolean; resolve: (event: CodeBenchEvent) => void }> = []

  const sink: CodeBenchEventSink = {
    id: 1,
    send: (_channel, payload) => {
      const event = payload as CodeBenchEvent
      collected.events.push(event)
      if (event.type === 'compile:output' || event.type === 'process:output') {
        collected.output += 'data' in event ? event.data : ''
      }
      if (event.type === 'compile:error' || event.type === 'process:error' || event.type === 'process:exit') {
        if ('message' in event && event.message) collected.output += `\n${event.message}`
      }
      for (let i = waiters.length - 1; i >= 0; i -= 1) {
        if (waiters[i].predicate(event)) {
          waiters[i].resolve(event)
          waiters.splice(i, 1)
        }
      }
    },
    isDestroyed: () => false,
  }

  return {
    sink,
    collected,
    waitFor(predicate, timeoutMs = 15_000) {
      const existing = collected.events.find(predicate)
      if (existing) return Promise.resolve(existing)
      return new Promise((resolve, reject) => {
        const timer = setTimeout(() => reject(new Error('Timed out waiting for CodeBench event')), timeoutMs)
        waiters.push({
          predicate,
          resolve: (event) => {
            clearTimeout(timer)
            resolve(event)
          },
        })
      })
    },
  }
}

async function runUntilDone(source: string, interact?: (ctx: ReturnType<typeof createSink> & { sessionId: string }) => Promise<void>) {
  const ctx = createSink()
  const ack = codeBenchProcessManager.beginRun(ctx.sink, { sourceCode: source, language: 'cpp' })
  if (!ack.ok) throw new Error(ack.error)
  if (interact) await interact({ ...ctx, sessionId: ack.sessionId })
  await ctx.waitFor((event) => event.type === 'process:exit' || (event.type === 'compile:complete' && !event.success))
  return ctx.collected
}

export async function runCodebenchSelftest(): Promise<boolean> {
  const results: Array<{ name: string; ok: boolean; detail: string }> = []
  const record = (name: string, ok: boolean, detail: string) => {
    results.push({ name, ok, detail })
    console.log(`${ok ? 'PASS' : 'FAIL'}  ${name} — ${detail}`)
  }

  try {
    const compiler = await detectCppCompiler()
    record(
      'compiler-detect',
      compiler.available,
      compiler.available ? `${compiler.compiler} ${compiler.version}` : 'no compiler',
    )
    if (!compiler.available) return false

    const pty = canLoadNodePty()
    record('pty-load', pty.ok, pty.ok ? 'node-pty ready' : pty.message)
    if (!pty.ok) return false

    const hello = await runUntilDone(`#include <iostream>
using namespace std;
int main() {
    cout << "Hello CourseCollab!" << endl;
    return 0;
}
`)
    record('test-1-hello', hello.output.includes('Hello CourseCollab!'), hello.output.slice(-200))

    const single = await runUntilDone(
      `#include <iostream>
using namespace std;
int main() {
    int number;
    cout << "Enter number: ";
    cin >> number;
    cout << number * 2 << endl;
    return 0;
}
`,
      async ({ waitFor, sessionId }) => {
        await waitFor((event) => event.type === 'process:output' && event.data.includes('Enter number'))
        codeBenchProcessManager.writeInput(sessionId, '21\n')
      },
    )
    record('test-2-single-cin', single.output.includes('42'), single.output.slice(-200))

    const multi = await runUntilDone(
      `#include <iostream>
#include <string>
using namespace std;
int main() {
    string name;
    int age;
    cout << "Enter your name: ";
    cin >> name;
    cout << "Enter your age: ";
    cin >> age;
    cout << "Hello " << name << "! You are " << age << " years old." << endl;
    return 0;
}
`,
      async ({ waitFor, sessionId }) => {
        await waitFor((event) => event.type === 'process:output' && event.data.includes('name'))
        codeBenchProcessManager.writeInput(sessionId, 'Daniel\n')
        await waitFor((event) => event.type === 'process:output' && event.data.includes('age'))
        codeBenchProcessManager.writeInput(sessionId, '30\n')
      },
    )
    record(
      'test-3-multi-cin',
      multi.output.includes('Hello Daniel') && multi.output.includes('30'),
      multi.output.slice(-240),
    )

    const looped = await runUntilDone(
      `#include <iostream>
using namespace std;
int main() {
    int value;
    while (cin >> value) {
        cout << "Received: " << value << endl;
    }
    return 0;
}
`,
      async ({ waitFor, sessionId }) => {
        await waitFor((event) => event.type === 'process:start')
        codeBenchProcessManager.writeInput(sessionId, '1\n')
        await waitFor((event) => event.type === 'process:output' && event.data.includes('Received: 1'))
        codeBenchProcessManager.writeInput(sessionId, '2\n')
        await waitFor((event) => event.type === 'process:output' && event.data.includes('Received: 2'))
        codeBenchProcessManager.writeInput(sessionId, '\x04')
      },
    )
    record(
      'test-4-looped-cin',
      looped.output.includes('Received: 1') && looped.output.includes('Received: 2'),
      looped.output.slice(-240),
    )

    const compileFail = await runUntilDone(`#include <iostream>
int main() {
    std::cout << "missing semicolon"
    return 0;
}
`)
    const failedCompile = compileFail.events.some((event) => event.type === 'compile:complete' && !event.success)
    record('test-5-compiler-error', failedCompile && /error/i.test(compileFail.output), compileFail.output.slice(-240))

    const crash = await runUntilDone(`#include <cstdlib>
int main() { abort(); }
`)
    const crashed = crash.events.some((event) => event.type === 'process:exit')
    record('test-6-runtime-failure', crashed, crash.output.slice(-200))

    const loop = createSink()
    const loopAck = codeBenchProcessManager.beginRun(loop.sink, {
      sourceCode: 'int main() { while (true) {} }\n',
      language: 'cpp',
    })
    if (!loopAck.ok) throw new Error(loopAck.error)
    await loop.waitFor((event) => event.type === 'process:start')
    await new Promise((resolve) => setTimeout(resolve, 400))
    await codeBenchProcessManager.stop(loopAck.sessionId, 'user')
    const stopped = loop.collected.events.some(
      (event) => event.type === 'process:exit' && (event.reason === 'user' || event.message?.includes('terminated')),
    )
    record('test-7-stop-infinite', stopped, loop.collected.output.slice(-200))

    const flood = await runUntilDone(`#include <iostream>
using namespace std;
int main() {
    while (true) { cout << "CourseCollab" << endl; }
}
`)
    const limited = flood.events.some(
      (event) => event.type === 'process:exit' && (event.reason === 'output-limit' || event.message?.includes('excessive')),
    )
    record('test-8-output-limit', limited, `bytes-ish output length=${flood.output.length}`)

    await cleanupAllSessions()
    record('workspace-cleanup', true, 'temporary sessions removed')
  } catch (error) {
    record('selftest-exception', false, error instanceof Error ? error.message : String(error))
  }

  const passed = results.filter((item) => item.ok).length
  console.log(`\nCodeBench selftest ${passed}/${results.length} passed`)
  return results.every((item) => item.ok)
}
