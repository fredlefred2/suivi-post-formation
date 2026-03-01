'use client'

import { useRef, useEffect } from 'react'

type PopoverProps = {
  open: boolean
  onClose: () => void
  children: React.ReactNode
  className?: string
}

export default function Popover({ open, onClose, children, className = '' }: PopoverProps) {
  const ref = useRef<HTMLDivElement>(null)

  useEffect(() => {
    if (!open) return
    function handleClickOutside(e: MouseEvent) {
      if (ref.current && !ref.current.contains(e.target as Node)) {
        onClose()
      }
    }
    // Petit délai pour éviter de fermer immédiatement au clic d'ouverture
    const timer = setTimeout(() => {
      document.addEventListener('mousedown', handleClickOutside)
    }, 10)
    return () => {
      clearTimeout(timer)
      document.removeEventListener('mousedown', handleClickOutside)
    }
  }, [open, onClose])

  if (!open) return null

  return (
    <div
      ref={ref}
      className={`absolute z-40 bg-white rounded-xl border border-gray-200 animate-scale-in ${className}`}
      style={{
        boxShadow: '0 8px 30px rgba(0, 0, 0, 0.12), 0 2px 8px rgba(0, 0, 0, 0.06)',
      }}
    >
      {children}
    </div>
  )
}
