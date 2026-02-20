"use client"

import { useState, useEffect, useCallback } from "react"
import {
  Shield,
  ShieldOff,
  UserX,
  UserCheck,
  Clock,
  AlertTriangle,
  Save,
} from "lucide-react"
import { Button } from "@/components/ui/button"
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs"
import { useAuth } from "@/lib/auth-context"
import { type User, type AppConfig, userStore, configStore } from "@/lib/store"
import { BackgroundsManager } from "@/components/backgrounds-manager"
import { useRouter } from "next/navigation"

export default function AdminPage() {
  const { user, loading } = useAuth()
  const router = useRouter()
  const [users, setUsers] = useState<User[]>([])
  const [config, setConfig] = useState<AppConfig>({ access_window_hours: 24, maintenance_mode: false })
  const [savingConfig, setSavingConfig] = useState(false)
  const [configSaved, setConfigSaved] = useState(false)

  const loadData = useCallback(async () => {
    const [allUsers, appConfig] = await Promise.all([
      userStore.getAll(),
      configStore.get(),
    ])
    setUsers(allUsers)
    setConfig(appConfig)
  }, [])

  useEffect(() => {
    if (!loading && (!user || user.role !== "admin")) {
      router.push("/")
      return
    }
    if (user) loadData()
  }, [user, loading, router, loadData])

  const toggleRole = async (targetUser: User) => {
    if (targetUser.id === user?.id) return
    await userStore.update({
      ...targetUser,
      role: targetUser.role === "admin" ? "user" : "admin",
    })
    await loadData()
  }

  const toggleDisabled = async (targetUser: User) => {
    if (targetUser.id === user?.id) return
    await userStore.update({
      ...targetUser,
      is_disabled: !targetUser.is_disabled,
    })
    await loadData()
  }

  const saveConfig = async () => {
    setSavingConfig(true)
    await configStore.update(config)
    setSavingConfig(false)
    setConfigSaved(true)
    setTimeout(() => setConfigSaved(false), 2000)
  }

  if (loading) {
    return (
      <div className="flex flex-1 items-center justify-center py-20">
        <div className="size-8 animate-spin rounded-full border-2 border-primary border-t-transparent" />
      </div>
    )
  }

  if (!user || user.role !== "admin") return null

  return (
    <div className="mx-auto w-full max-w-6xl px-4 py-8">
      <div className="mb-8">
        <h1 className="text-3xl font-bold tracking-tight text-foreground">Admin Dashboard</h1>
        <p className="mt-1 text-sm text-muted-foreground">
          Manage users, backgrounds, and application settings
        </p>
      </div>

      <Tabs defaultValue="backgrounds" className="space-y-6">
        <TabsList className="bg-secondary">
          <TabsTrigger value="backgrounds">Backgrounds</TabsTrigger>
          <TabsTrigger value="config">Configuration</TabsTrigger>
          <TabsTrigger value="users">Users</TabsTrigger>
        </TabsList>

        {/* Backgrounds tab */}
        <TabsContent value="backgrounds">
          <div className="rounded-2xl border border-border bg-card p-6">
            <BackgroundsManager />
          </div>
        </TabsContent>

        {/* Configuration tab */}
        <TabsContent value="config">
          <div className="rounded-2xl border border-border bg-card p-6">
            <h3 className="mb-6 text-lg font-semibold text-foreground">Application Settings</h3>
            <div className="space-y-6 max-w-md">
              {/* Access Window */}
              <div className="space-y-2">
                <label className="flex items-center gap-2 text-sm font-medium text-foreground">
                  <Clock className="size-4 text-muted-foreground" />
                  Access Window (hours)
                </label>
                <p className="text-xs text-muted-foreground">
                  How long photos remain visible in the gallery
                </p>
                <input
                  type="number"
                  min={1}
                  max={720}
                  value={config.access_window_hours}
                  onChange={(e) =>
                    setConfig({ ...config, access_window_hours: parseInt(e.target.value) || 24 })
                  }
                  className="w-full rounded-lg border border-border bg-input px-3 py-2 text-sm text-foreground placeholder:text-muted-foreground focus:outline-none focus:ring-2 focus:ring-ring"
                />
              </div>

              {/* Maintenance Mode */}
              <div className="flex items-center justify-between rounded-lg border border-border p-4">
                <div className="flex items-center gap-3">
                  <AlertTriangle className="size-5 text-accent" />
                  <div>
                    <p className="text-sm font-medium text-foreground">Maintenance Mode</p>
                    <p className="text-xs text-muted-foreground">Disable the booth for all users</p>
                  </div>
                </div>
                <button
                  onClick={() => setConfig({ ...config, maintenance_mode: !config.maintenance_mode })}
                  className={`relative h-6 w-11 rounded-full transition-colors ${
                    config.maintenance_mode ? "bg-accent" : "bg-border"
                  }`}
                  role="switch"
                  aria-checked={config.maintenance_mode}
                >
                  <span
                    className={`absolute top-0.5 left-0.5 size-5 rounded-full bg-foreground transition-transform ${
                      config.maintenance_mode ? "translate-x-5" : "translate-x-0"
                    }`}
                  />
                </button>
              </div>

              <Button
                onClick={saveConfig}
                disabled={savingConfig}
                className="gap-2 bg-primary text-primary-foreground hover:bg-primary/90"
              >
                <Save className="size-4" />
                {savingConfig ? "Saving..." : configSaved ? "Saved!" : "Save Settings"}
              </Button>
            </div>
          </div>
        </TabsContent>

        {/* Users tab */}
        <TabsContent value="users">
          <div className="rounded-2xl border border-border bg-card">
            <div className="p-6">
              <h3 className="text-lg font-semibold text-foreground">User Management</h3>
              <p className="mt-1 text-sm text-muted-foreground">
                {users.length} registered {users.length === 1 ? "user" : "users"}
              </p>
            </div>
            <div className="border-t border-border">
              {users.length === 0 ? (
                <p className="p-6 text-center text-sm text-muted-foreground">No users found.</p>
              ) : (
                <div className="divide-y divide-border">
                  {users.map((u) => (
                    <div
                      key={u.id}
                      className="flex items-center justify-between px-6 py-4"
                    >
                      <div className="flex items-center gap-4">
                        <div className="flex size-10 items-center justify-center rounded-full bg-secondary text-sm font-semibold text-foreground">
                          {u.full_name.charAt(0).toUpperCase()}
                        </div>
                        <div>
                          <p className="text-sm font-medium text-foreground">
                            {u.full_name}
                            {u.id === user.id && (
                              <span className="ml-2 text-xs text-muted-foreground">(you)</span>
                            )}
                          </p>
                          <p className="text-xs text-muted-foreground">{u.email}</p>
                        </div>
                      </div>
                      <div className="flex items-center gap-3">
                        <span
                          className={`rounded-full px-2.5 py-0.5 text-xs font-medium ${
                            u.role === "admin"
                              ? "bg-primary/10 text-primary"
                              : "bg-secondary text-muted-foreground"
                          }`}
                        >
                          {u.role}
                        </span>
                        {u.is_disabled && (
                          <span className="rounded-full bg-destructive/10 px-2.5 py-0.5 text-xs font-medium text-destructive">
                            disabled
                          </span>
                        )}
                        {u.id !== user.id && (
                          <div className="flex gap-1">
                            <Button
                              variant="ghost"
                              size="icon"
                              className="size-8 text-muted-foreground hover:text-foreground"
                              onClick={() => toggleRole(u)}
                              title={u.role === "admin" ? "Demote to user" : "Promote to admin"}
                            >
                              {u.role === "admin" ? (
                                <ShieldOff className="size-4" />
                              ) : (
                                <Shield className="size-4" />
                              )}
                            </Button>
                            <Button
                              variant="ghost"
                              size="icon"
                              className="size-8 text-muted-foreground hover:text-foreground"
                              onClick={() => toggleDisabled(u)}
                              title={u.is_disabled ? "Enable account" : "Disable account"}
                            >
                              {u.is_disabled ? (
                                <UserCheck className="size-4" />
                              ) : (
                                <UserX className="size-4" />
                              )}
                            </Button>
                          </div>
                        )}
                      </div>
                    </div>
                  ))}
                </div>
              )}
            </div>
          </div>
        </TabsContent>
      </Tabs>
    </div>
  )
}
