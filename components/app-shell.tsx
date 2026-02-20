"use client"

import { AuthProvider } from "@/lib/auth-context"
import { NavBar } from "@/components/nav-bar"

export function AppShell({ children }: { children: React.ReactNode }) {
  return (
    <AuthProvider>
      <div className="flex min-h-screen flex-col bg-background">
        <NavBar />
        <main className="flex flex-1 flex-col">{children}</main>
      </div>
    </AuthProvider>
  )
}
