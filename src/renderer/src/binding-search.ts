import { summarizeAction } from '../../shared/action-summary'
import type { Binding } from '../../shared/types'

function bindingSearchText(binding: Binding): string {
  const actionTargets =
    binding.action.type === 'workflow'
      ? (binding.action.steps ?? [])
          .flatMap((step) => [step.type, step.target, step.args ?? ''])
          .join(' ')
      : [binding.action.type, binding.action.target ?? '', binding.action.args ?? ''].join(' ')

  return [
    binding.accelerator,
    binding.name ?? '',
    binding.description,
    summarizeAction(binding.action),
    actionTargets
  ]
    .join(' ')
    .toLocaleLowerCase()
}

/** Case-insensitive AND search shared by the Bindings tab and pinned menu. */
export function bindingMatchesQuery(binding: Binding, query: string): boolean {
  const terms = query.trim().toLocaleLowerCase().split(/\s+/).filter(Boolean)
  if (terms.length === 0) return true
  const text = bindingSearchText(binding)
  return terms.every((term) => text.includes(term))
}
