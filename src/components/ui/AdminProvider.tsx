'use client'
import { createContext, useContext, useState, useEffect, useCallback } from 'react'

export type UserRole = 'none' | 'visiteur' | 'admin'

interface AuthContextType {
  role: UserRole
  isAdmin: boolean
  isLoggedIn: boolean
  login: (password: string) => Promise<UserRole | false>
  logout: () => void
}

const AuthContext = createContext<AuthContextType>({
  role: 'none',
  isAdmin: false,
  isLoggedIn: false,
  login: async () => false,
  logout: () => {},
})

export function useAdmin() {
  return useContext(AuthContext)
}

export default function AdminProvider({ children }: { children: React.ReactNode }) {
  const [role, setRole] = useState<UserRole>('none')

  useEffect(() => {
    const stored = localStorage.getItem('valcausse_auth')
    if (stored) {
      try {
        const { role: r, expires } = JSON.parse(stored)
        if (Date.now() < expires && (r === 'admin' || r === 'visiteur')) {
          setRole(r)
        } else {
          localStorage.removeItem('valcausse_auth')
        }
      } catch {
        localStorage.removeItem('valcausse_auth')
      }
    }
  }, [])

  const login = useCallback(async (password: string): Promise<UserRole | false> => {
    const res = await fetch('/api/admin/login', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ password }),
    })
    if (res.ok) {
      const { role: r } = await res.json()
      const expires = Date.now() + 8 * 60 * 60 * 1000 // 8h
      localStorage.setItem('valcausse_auth', JSON.stringify({ role: r, expires }))
      setRole(r)
      return r
    }
    return false
  }, [])

  const logout = useCallback(() => {
    localStorage.removeItem('valcausse_auth')
    setRole('none')
  }, [])

  return (
    <AuthContext.Provider value={{
      role,
      isAdmin: role === 'admin',
      isLoggedIn: role !== 'none',
      login,
      logout,
    }}>
      {children}
    </AuthContext.Provider>
  )
}
