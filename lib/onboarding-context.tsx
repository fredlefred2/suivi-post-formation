'use client'

import { createContext, useContext, useState, type ReactNode } from 'react'

type OnboardingContextType = {
  isOnboarding: boolean
  setIsOnboarding: (value: boolean) => void
}

const OnboardingContext = createContext<OnboardingContextType>({
  isOnboarding: false,
  setIsOnboarding: () => {},
})

export function OnboardingProvider({ children }: { children: ReactNode }) {
  const [isOnboarding, setIsOnboarding] = useState(false)
  return (
    <OnboardingContext.Provider value={{ isOnboarding, setIsOnboarding }}>
      {children}
    </OnboardingContext.Provider>
  )
}

export function useOnboarding() {
  return useContext(OnboardingContext)
}
