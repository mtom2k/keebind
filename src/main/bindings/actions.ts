import { Notification, shell } from 'electron'
import { spawn } from 'node:child_process'
import type { ActionSpec, ActionStep } from '../../shared/types'

const sleep = (ms: number) => new Promise((r) => setTimeout(r, ms))

/** Split a CLI argument string, honoring double quotes. */
function splitArgs(args: string): string[] {
  const out: string[] = []
  for (const m of args.matchAll(/"([^"]*)"|(\S+)/g)) out.push(m[1] ?? m[2])
  return out
}

function normalizeUrl(url: string): string {
  return /^[a-z][a-z0-9+.-]*:/i.test(url) ? url : `https://${url}`
}

function launchApp(target: string, args?: string): void {
  const extra = args ? splitArgs(args) : []
  let child
  if (process.platform === 'darwin') {
    child = spawn('open', ['-a', target, ...(extra.length ? ['--args', ...extra] : [])], {
      detached: true,
      stdio: 'ignore'
    })
  } else if (process.platform === 'win32') {
    // `start` resolves both .exe paths and registered app names/associations
    child = spawn('cmd.exe', ['/d', '/s', '/c', 'start', '', target, ...extra], {
      detached: true,
      stdio: 'ignore',
      windowsHide: true
    })
  } else {
    child = spawn('xdg-open', [target], { detached: true, stdio: 'ignore' })
  }
  child.unref()
}

function runShellCommand(command: string): void {
  const child =
    process.platform === 'win32'
      ? spawn('cmd.exe', ['/d', '/s', '/c', command], {
          detached: true,
          stdio: 'ignore',
          windowsHide: true
        })
      : spawn(process.env.SHELL ?? '/bin/zsh', ['-lc', command], {
          detached: true,
          stdio: 'ignore'
        })
  child.unref()
}

async function runStep(step: ActionStep): Promise<void> {
  if (step.delayMs && step.delayMs > 0) await sleep(step.delayMs)
  switch (step.type) {
    case 'openUrl':
      await shell.openExternal(normalizeUrl(step.target))
      break
    case 'openPath': {
      const error = await shell.openPath(step.target)
      if (error) throw new Error(error)
      break
    }
    case 'launchApp':
      launchApp(step.target, step.args)
      break
    case 'shellCommand':
      runShellCommand(step.target)
      break
  }
}

export async function runAction(spec: ActionSpec): Promise<void> {
  if (spec.type === 'workflow') {
    for (const step of spec.steps ?? []) await runStep(step)
    return
  }
  await runStep({ type: spec.type, target: spec.target ?? '', args: spec.args })
}

export function notifyActionError(description: string, err: unknown): void {
  const body = err instanceof Error ? err.message : String(err)
  new Notification({
    title: `Keebind: "${description}" failed`,
    body
  }).show()
}
