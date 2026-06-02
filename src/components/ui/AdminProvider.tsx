'use client'
import { createContext, useContext, useState, useEffect, useCallback } from 'react'

interface AdminContextType {
  isAdmin: boolean
  login: (password: string) => Promise<boolean>
  logout: () => void
}

const AdminContext = createContext<AdminContextType>({
  isAdmin: false,
  login: async () => false,
  logout: () => {},
})

export function useAdmin() {
  return useContext(AdminContext)
}

export default function AdminProvider({ children }: { children: React.ReactNode }) {
  const [isAdmin, setIsAdmin] = useState(false)

  useEffect(() => {
    const stored = localStorage.getItem('valcausse_admin')
    if (stored) {
      try {
        const { expires } = JSON.parse(stored)
        if (Date.now() < expires) setIsAdmin(true)
        else localStorage.removeItem('valcausse_admin')
      } catch {
        localStorage.removeItem('valcausse_admin')
      }
    }
  }, [])

  const login = useCallback(async (password: string): Promise<boolean> => {
    const res = await fetch('/api/admin/login', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ password }),
    })
    if (res.ok) {
      const expires = Date.now() + 8 * 60 * 60 * 1000
      localStorage.setItem('valcausse_admin', JSON.stringify({ expires }))
      setIsAdmin(true)
      return true
    }
    return false
  }, [])

  const logout = useCallback(() => {
    localStorage.removeItem('valcausse_admin')
    setIsAdmin(false)
  }, [])

  return (
    <AdminContext.Provider value={{ isAdmin, login, logout }}>
      {children}
    </AdminContext.Provider>
  )
}
