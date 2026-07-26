import type { ActionSpec, ActionStep, PickKind, StepType } from '../../../shared/types'
import { Tooltip } from './Tooltip'

const STEP_TYPES: { value: StepType; label: string; tip: string; placeholder: string }[] = [
  {
    value: 'launchApp',
    label: 'Launch app',
    tip: 'Open an application. Browse for it, or type its name or full path.',
    placeholder: 'App name or full path'
  },
  {
    value: 'openUrl',
    label: 'Open URL',
    tip: 'Open a link in your default browser',
    placeholder: 'https://…'
  },
  {
    value: 'openPath',
    label: 'Open file/folder',
    tip: 'Open a file or folder with whatever app normally handles it',
    placeholder: 'Path to a file or folder'
  },
  {
    value: 'shellCommand',
    label: 'Shell command',
    tip: 'Run a command in your shell (zsh on macOS, cmd on Windows)',
    placeholder: 'command to run'
  }
]

function stepMeta(type: StepType) {
  return STEP_TYPES.find((t) => t.value === type)!
}

/**
 * Browse buttons for the targets that are paths. Windows file dialogs can't
 * offer files and folders at once, so "Open file/folder" gets two buttons
 * there; on macOS one dialog covers both.
 */
function BrowseButtons({
  type,
  onPick
}: {
  type: StepType
  onPick: (path: string) => void
}) {
  const pick = async (kind: PickKind) => {
    const path = await window.keebind.pickPath(kind)
    if (path) onPick(path)
  }

  if (type === 'launchApp') {
    return (
      <Tooltip tip="Find the app in Finder or File Explorer">
        <button type="button" className="btn" onClick={() => pick('app')}>
          Browse
        </button>
      </Tooltip>
    )
  }
  if (type === 'openPath') {
    return (
      <>
        <Tooltip tip="Pick a file">
          <button type="button" className="btn" onClick={() => pick('file')}>
            File
          </button>
        </Tooltip>
        <Tooltip tip="Pick a folder">
          <button type="button" className="btn" onClick={() => pick('folder')}>
            Folder
          </button>
        </Tooltip>
      </>
    )
  }
  return null
}

function StepFields({
  step,
  onChange,
  showType = true
}: {
  step: ActionStep
  onChange: (s: ActionStep) => void
  showType?: boolean
}) {
  const meta = stepMeta(step.type)
  return (
    <>
      {showType && (
        <Tooltip tip="What this step does">
          <select
            value={step.type}
            onChange={(e) => onChange({ ...step, type: e.target.value as StepType })}
          >
            {STEP_TYPES.map((t) => (
              <option key={t.value} value={t.value}>
                {t.label}
              </option>
            ))}
          </select>
        </Tooltip>
      )}
      <input
        type="text"
        style={{ flex: 1, minWidth: 0 }}
        value={step.target}
        placeholder={meta.placeholder}
        onChange={(e) => onChange({ ...step, target: e.target.value })}
      />
      <BrowseButtons type={step.type} onPick={(target) => onChange({ ...step, target })} />
      {step.type === 'launchApp' && (
        <Tooltip tip="Optional command-line arguments passed to the app">
          <input
            type="text"
            style={{ width: 110 }}
            value={step.args ?? ''}
            placeholder="args"
            onChange={(e) => onChange({ ...step, args: e.target.value || undefined })}
          />
        </Tooltip>
      )}
    </>
  )
}

interface Props {
  value: ActionSpec
  onChange: (action: ActionSpec) => void
}

export function ActionEditor({ value, onChange }: Props) {
  const isWorkflow = value.type === 'workflow'
  const steps = value.steps ?? []

  const setSteps = (next: ActionStep[]) => onChange({ ...value, steps: next })

  const moveStep = (i: number, dir: -1 | 1) => {
    const next = [...steps]
    const j = i + dir
    if (j < 0 || j >= next.length) return
    ;[next[i], next[j]] = [next[j], next[i]]
    setSteps(next)
  }

  return (
    <div>
      <div className="row" style={{ marginBottom: 8 }}>
        <Tooltip tip="One action, or a workflow of several steps run in order">
          <select
            value={isWorkflow ? 'workflow' : value.type}
            onChange={(e) => {
              const t = e.target.value
              if (t === 'workflow') {
                onChange({
                  type: 'workflow',
                  steps: value.type !== 'workflow' && value.target
                    ? [{ type: value.type, target: value.target, args: value.args }]
                    : steps.length
                      ? steps
                      : [{ type: 'launchApp', target: '' }]
                })
              } else {
                onChange({ type: t as StepType, target: value.target ?? '', args: value.args })
              }
            }}
          >
            {STEP_TYPES.map((t) => (
              <option key={t.value} value={t.value}>
                {t.label}
              </option>
            ))}
            <option value="workflow">Workflow (multiple steps)</option>
          </select>
        </Tooltip>
      </div>

      {!isWorkflow && (
        <div className="row wrap">
          <StepFields
            showType={false}
            step={{ type: value.type as StepType, target: value.target ?? '', args: value.args }}
            onChange={(s) => onChange({ type: s.type, target: s.target, args: s.args })}
          />
        </div>
      )}

      {isWorkflow && (
        <div>
          {steps.map((step, i) => (
            <div className="step-row" key={i}>
              <span className="step-num">{i + 1}.</span>
              {/* Target fields wrap as a group; the delay and the reorder
                  buttons stay together on the trailing line. */}
              <div className="step-fields">
                <StepFields
                  step={step}
                  onChange={(s) => setSteps(steps.map((old, j) => (j === i ? s : old)))}
                />
              </div>
              <div className="step-tail">
                <Tooltip tip="Wait this many milliseconds before running this step">
                  <input
                    type="number"
                    min={0}
                    style={{ width: 72 }}
                    value={step.delayMs ?? 0}
                    onChange={(e) =>
                      setSteps(
                        steps.map((old, j) =>
                          j === i ? { ...old, delayMs: Number(e.target.value) || undefined } : old
                        )
                      )
                    }
                  />
                </Tooltip>
                <span className="muted small">ms</span>
                <Tooltip tip="Move this step up">
                  <button
                    type="button"
                    className="btn icon-square"
                    disabled={i === 0}
                    onClick={() => moveStep(i, -1)}
                  >
                    ↑
                  </button>
                </Tooltip>
                <Tooltip tip="Move this step down">
                  <button
                    type="button"
                    className="btn icon-square"
                    disabled={i === steps.length - 1}
                    onClick={() => moveStep(i, 1)}
                  >
                    ↓
                  </button>
                </Tooltip>
                <Tooltip tip="Remove this step">
                  <button
                    type="button"
                    className="btn danger icon-square"
                    onClick={() => setSteps(steps.filter((_, j) => j !== i))}
                  >
                    ✕
                  </button>
                </Tooltip>
              </div>
            </div>
          ))}
          <div style={{ marginTop: 8 }}>
            <Tooltip tip="Add another step to this workflow">
              <button
                type="button"
                className="btn"
                onClick={() => setSteps([...steps, { type: 'launchApp', target: '' }])}
              >
                + Add step
              </button>
            </Tooltip>
          </div>
        </div>
      )}
    </div>
  )
}
