'use client'

import { createContext, useContext, useState, useCallback, useEffect } from 'react'
import { CheckCircle2, AlertCircle, X } from 'lucide-react'

type ToastType = 'success' | 'error'
type Toast = { id: number; message: string; type: ToastType }

const ToastContext = createContext<{
  toast: (message: string, type?: ToastType) => void
}>({ toast: () => {} })

export function useToast() {
  return useContext(ToastContext)
}

export function ToastProvider({ children }: { children: React.ReactNode }) {
  const [toasts, setToasts] = useState<Toast[]>([])
  let counter = 0

  const addToast = useCallback((message: string, type: ToastType = 'success') => {
    const id = Date.now() + counter++
    setToasts((prev) => [...prev, { id, message, type }])
    setTimeout(() => {
      setToasts((prev) => prev.filter((t) => t.id !== id))
    }, 3500)
  }, [])

  const removeToast = useCallback((id: number) => {
    setToasts((prev) => prev.filter((t) => t.id !== id))
  }, [])

  return (
    <ToastContext.Provider value={{ toast: addToast }}>
      {children}
      {/* Toast container */}
      <div className="fixed top-4 right-4 z-[100] flex flex-col gap-2 pointer-events-none">
        {toasts.map((t) => (
          <div
            key={t.id}
            className="pointer-events-auto animate-slide-in flex items-center gap-2.5 px-4 py-3 rounded-xl text-sm font-medium shadow-lg border backdrop-blur-sm"
            style={{
              background: t.type === 'success' ? 'rgba(236, 253, 245, 0.95)' : 'rgba(254, 242, 242, 0.95)',
              borderColor: t.type === 'success' ? '#6ee7b7' : '#fca5a5',
              color: t.type === 'success' ? '#065f46' : '#991b1b',
            }}
          >
            {t.type === 'success' ? <CheckCircle2 size={18} /> : <AlertCircle size={18} />}
            <span>{t.message}</span>
            <button onClick={() => removeToast(t.id)} className="ml-2 opacity-50 hover:opacity-100">
              <X size={14} />
            </button>
          </div>
        ))}
      </div>
    </ToastContext.Provider>
  )
}
