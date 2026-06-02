'use client'
import { useAdmin } from './AdminProvider'
import LoginScreen from './LoginScreen'

export default function AuthGate({ children }: { children: React.ReactNode }) {
  const { isLoggedIn } = useAdmin()

  if (!isLoggedIn) {
    return <LoginScreen />
  }

  return <>{children}</>
}
