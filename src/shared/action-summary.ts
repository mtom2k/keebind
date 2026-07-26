import type { ActionSpec, ActionStep, Binding, StepType } from './types'

const STEP_LABELS: Record<StepType, string> = {
  launchApp: 'Launch app',
  openUrl: 'Open URL',
  openPath: 'Open file/folder',
  shellCommand: 'Shell command'
}

function describeStep(step: ActionStep): string {
  let detail = `${STEP_LABELS[step.type]}: ${step.target || '(no target)'}`
  if (step.type === 'launchApp' && step.args) detail += ` ${step.args}`
  if (step.delayMs && step.delayMs > 0) detail += ` (after ${step.delayMs} ms)`
  return detail
}

/** Compact one-line label used in lists and search. */
export function summarizeAction(action: ActionSpec): string {
  if (action.type === 'workflow') {
    const steps = action.steps ?? []
    const names = steps.map((step) => STEP_LABELS[step.type].toLowerCase()).join(', then ')
    return `Workflow, ${steps.length} step${steps.length === 1 ? '' : 's'}: ${names}`
  }
  return describeStep({
    type: action.type,
    target: action.target ?? '',
    args: action.args
  })
}

/** Complete action description used by the run-confirmation dialog. */
export function describeAction(action: ActionSpec): string {
  if (action.type !== 'workflow') {
    return describeStep({
      type: action.type,
      target: action.target ?? '',
      args: action.args
    })
  }

  const steps = action.steps ?? []
  if (steps.length === 0) return 'Workflow with no steps'
  return [
    `Workflow with ${steps.length} step${steps.length === 1 ? '' : 's'}:`,
    ...steps.map((step, index) => `${index + 1}. ${describeStep(step)}`)
  ].join('\n')
}

/** Stable user-facing identity for a binding, including legacy records. */
export function bindingDisplayName(
  binding: Pick<Binding, 'name' | 'description' | 'accelerator'>
): string {
  return binding.name?.trim() || binding.description.trim() || binding.accelerator
}
