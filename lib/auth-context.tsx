"use client"

import React, { createContext, useContext, useState, useEffect, useCallback } from "react"
import { type User, userStore } from "@/lib/store"

interface AuthContextType {
  user: User | null
  loading: boolean
  login: (email: string, password: string) => Promise<{ success: boolean; error?: string }>
  signup: (email: string, password: string, fullName: string) => Promise<{ success: boolean; error?: string }>
  logout: () => void
}

const AuthContext = createContext<AuthContextType | undefined>(undefined)

export function AuthProvider({ children }: { children: React.ReactNode }) {
  const [user, setUser] = useState<User | null>(null)
  const [loading, setLoading] = useState(true)

  useEffect(() => {
    const storedUserId = sessionStorage.getItem("photobooth_user_id")
    if (storedUserId) {
      userStore.getById(storedUserId).then((u) => {
        if (u && !u.is_disabled) {
          setUser(u)
        } else {
          sessionStorage.removeItem("photobooth_user_id")
        }
        setLoading(false)
      })
    } else {
      setLoading(false)
    }
  }, [])

  const login = useCallback(async (email: string, _password: string): Promise<{ success: boolean; error?: string }> => {
    const existingUser = await userStore.getByEmail(email)
    if (existingUser) {
      if (existingUser.is_disabled) {
        return { success: false, error: "Account is disabled. Contact an administrator." }
      }
      setUser(existingUser)
      sessionStorage.setItem("photobooth_user_id", existingUser.id)
      return { success: true }
    }
    return { success: false, error: "Invalid email or password." }
  }, [])

  const signup = useCallback(async (email: string, _password: string, fullName: string): Promise<{ success: boolean; error?: string }> => {
    const existingUser = await userStore.getByEmail(email)
    if (existingUser) {
      return { success: false, error: "An account with this email already exists." }
    }
    const allUsers = await userStore.getAll()
    const isFirstUser = allUsers.length === 0
    const newUser: User = {
      id: crypto.randomUUID(),
      email,
      full_name: fullName,
      role: isFirstUser ? "admin" : "user",
      is_disabled: false,
      created_at: new Date().toISOString(),
    }
    await userStore.create(newUser)
    setUser(newUser)
    sessionStorage.setItem("photobooth_user_id", newUser.id)
    return { success: true }
  }, [])

  const logout = useCallback(() => {
    setUser(null)
    sessionStorage.removeItem("photobooth_user_id")
  }, [])

  return (
    <AuthContext.Provider value={{ user, loading, login, signup, logout }}>
      {children}
    </AuthContext.Provider>
  )
}

export function useAuth() {
  const context = useContext(AuthContext)
  if (context === undefined) {
    throw new Error("useAuth must be used within an AuthProvider")
  }
  return context
}
