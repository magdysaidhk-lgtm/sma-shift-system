import { createContext, useCallback, useContext, useRef, useState, type ReactNode } from 'react'

interface DialogState {
  kind: 'alert' | 'confirm'
  message: string
  resolve: (value: boolean) => void
}

interface DialogApi {
  alert: (message: string) => Promise<void>
  confirm: (message: string) => Promise<boolean>
}

const DialogContext = createContext<DialogApi | null>(null)

// Native window.alert/confirm can be silently blocked inside sandboxed
// preview iframes — same issue the original HTML file worked around with a
// custom modal. Reusing that approach here for the same reason.
export function DialogProvider({ children }: { children: ReactNode }) {
  const [state, setState] = useState<DialogState | null>(null)
  const resolveRef = useRef<((value: boolean) => void) | null>(null)

  const alert = useCallback((message: string) => {
    return new Promise<void>((resolve) => {
      resolveRef.current = () => resolve()
      setState({ kind: 'alert', message, resolve: () => resolve() })
    })
  }, [])

  const confirm = useCallback((message: string) => {
    return new Promise<boolean>((resolve) => {
      resolveRef.current = resolve
      setState({ kind: 'confirm', message, resolve })
    })
  }, [])

  function handle(result: boolean) {
    state?.resolve(result)
    setState(null)
  }

  return (
    <DialogContext.Provider value={{ alert, confirm }}>
      {children}
      <div className={`modal-backdrop no-print ${state ? 'show' : ''}`}>
        <div className="modal-box" style={{ maxWidth: 380 }}>
          <div className="modal-head">
            <strong>{state?.kind === 'confirm' ? 'تأكيد' : 'تنبيه'}</strong>
          </div>
          <p style={{ margin: '0 0 18px', fontSize: 13.5, color: 'var(--ink)', lineHeight: 1.8 }}>
            {state?.message}
          </p>
          <div className="row" style={{ justifyContent: 'flex-end' }}>
            {state?.kind === 'confirm' && (
              <button className="btn ghost" onClick={() => handle(false)}>إلغاء</button>
            )}
            <button
              className={state?.kind === 'confirm' ? 'btn danger' : 'btn secondary'}
              onClick={() => handle(true)}
            >
              {state?.kind === 'confirm' ? 'تأكيد' : 'حسناً'}
            </button>
          </div>
        </div>
      </div>
    </DialogContext.Provider>
  )
}

export function useDialog() {
  const ctx = useContext(DialogContext)
  if (!ctx) throw new Error('useDialog must be used within DialogProvider')
  return ctx
}
