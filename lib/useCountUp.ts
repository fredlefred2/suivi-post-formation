'use client'

import { useState, useEffect } from 'react'

/**
 * Hook qui anime un compteur : affiche des valeurs aléatoires
 * pendant `duration` ms puis se stabilise sur la valeur finale.
 */
export function useCountUp(target: number, duration = 800): number {
  const [display, setDisplay] = useState(0)

  useEffect(() => {
    if (target === 0) {
      setDisplay(0)
      return
    }

    const steps = 8
    const interval = duration / (steps + 1)
    let step = 0
    const maxRandom = Math.max(target * 3, 20)

    const timer = setInterval(() => {
      step++
      if (step <= steps) {
        setDisplay(Math.floor(Math.random() * maxRandom))
      } else {
        setDisplay(target)
        clearInterval(timer)
      }
    }, interval)

    return () => clearInterval(timer)
  }, [target, duration])

  return display
}
