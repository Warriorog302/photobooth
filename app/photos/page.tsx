"use client"

import { useState, useEffect, useCallback } from "react"
import { Download, Edit3, Trash2, Images, Clock, Eye, EyeOff } from "lucide-react"
import { Button } from "@/components/ui/button"
import { useAuth } from "@/lib/auth-context"
import { type Photo, type AppConfig, photoStore, configStore } from "@/lib/store"
import { PhotoEditor } from "@/components/photo-editor"
import { useRouter } from "next/navigation"

export default function PhotosPage() {
  const { user, loading } = useAuth()
  const router = useRouter()
  const [photos, setPhotos] = useState<Photo[]>([])
  const [config, setConfig] = useState<AppConfig | null>(null)
  const [editingPhoto, setEditingPhoto] = useState<Photo | null>(null)
  const [loadingPhotos, setLoadingPhotos] = useState(true)

  const loadPhotos = useCallback(async () => {
    if (!user) return
    setLoadingPhotos(true)
    const [userPhotos, appConfig] = await Promise.all([
      photoStore.getByUser(user.id),
      configStore.get(),
    ])
    setConfig(appConfig)
    // Filter by access window
    const cutoff = new Date()
    cutoff.setHours(cutoff.getHours() - appConfig.access_window_hours)
    const filtered = userPhotos.filter(
      (p) => new Date(p.created_date) >= cutoff
    )
    setPhotos(filtered)
    setLoadingPhotos(false)
  }, [user])

  useEffect(() => {
    if (!loading && !user) {
      router.push("/auth/login")
      return
    }
    if (user) loadPhotos()
  }, [user, loading, router, loadPhotos])

  const downloadPhoto = (photo: Photo) => {
    const link = document.createElement("a")
    link.href = photo.image_url
    link.download = `photo-${photo.id}.png`
    link.click()
  }

  const toggleVisibility = async (photo: Photo) => {
    await photoStore.update({ ...photo, is_public: !photo.is_public })
    await loadPhotos()
  }

  const deletePhoto = async (id: string) => {
    await photoStore.delete(id)
    await loadPhotos()
  }

  if (loading || loadingPhotos) {
    return (
      <div className="flex flex-1 items-center justify-center py-20">
        <div className="size-8 animate-spin rounded-full border-2 border-primary border-t-transparent" />
      </div>
    )
  }

  return (
    <div className="mx-auto w-full max-w-6xl px-4 py-8">
      <div className="mb-8 flex items-center justify-between">
        <div>
          <h1 className="text-3xl font-bold tracking-tight text-foreground">My Photos</h1>
          <p className="mt-1 flex items-center gap-1.5 text-sm text-muted-foreground">
            <Clock className="size-3.5" />
            Showing photos from the last {config?.access_window_hours ?? 24} hours
          </p>
        </div>
      </div>

      {photos.length === 0 ? (
        <div className="flex flex-col items-center gap-4 rounded-2xl border border-dashed border-border py-20 text-center">
          <Images className="size-16 text-muted-foreground" />
          <div>
            <p className="text-lg font-medium text-foreground">No photos yet</p>
            <p className="mt-1 text-sm text-muted-foreground">
              Head to the Booth to capture your first photo
            </p>
          </div>
          <Button
            onClick={() => router.push("/")}
            className="mt-2 gap-2 bg-primary text-primary-foreground hover:bg-primary/90"
          >
            Go to Booth
          </Button>
        </div>
      ) : (
        <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
          {photos.map((photo) => (
            <div
              key={photo.id}
              className="group relative overflow-hidden rounded-2xl border border-border bg-card shadow-sm transition-shadow hover:shadow-lg"
            >
              {/* eslint-disable-next-line @next/next/no-img-element */}
              <img
                src={photo.image_url}
                alt="Photo booth capture"
                className="aspect-video w-full object-cover"
              />
              {/* Overlay actions */}
              <div className="absolute inset-0 flex items-end bg-gradient-to-t from-background/80 via-transparent to-transparent opacity-0 transition-opacity group-hover:opacity-100">
                <div className="flex w-full items-center justify-between p-3">
                  <span className="text-xs text-muted-foreground">
                    {new Date(photo.created_date).toLocaleString()}
                  </span>
                  <div className="flex gap-1">
                    <Button
                      variant="ghost"
                      size="icon"
                      className="size-8 text-foreground hover:bg-secondary"
                      onClick={() => toggleVisibility(photo)}
                      title={photo.is_public ? "Make Private" : "Make Public"}
                    >
                      {photo.is_public ? <Eye className="size-3.5" /> : <EyeOff className="size-3.5" />}
                    </Button>
                    <Button
                      variant="ghost"
                      size="icon"
                      className="size-8 text-foreground hover:bg-secondary"
                      onClick={() => setEditingPhoto(photo)}
                      title="Edit"
                    >
                      <Edit3 className="size-3.5" />
                    </Button>
                    <Button
                      variant="ghost"
                      size="icon"
                      className="size-8 text-foreground hover:bg-secondary"
                      onClick={() => downloadPhoto(photo)}
                      title="Download"
                    >
                      <Download className="size-3.5" />
                    </Button>
                    <Button
                      variant="ghost"
                      size="icon"
                      className="size-8 text-foreground hover:text-destructive"
                      onClick={() => deletePhoto(photo.id)}
                      title="Delete"
                    >
                      <Trash2 className="size-3.5" />
                    </Button>
                  </div>
                </div>
              </div>

              {/* Public badge */}
              {photo.is_public && (
                <div className="absolute left-2 top-2 rounded-full bg-primary/20 px-2 py-0.5 text-xs font-medium text-primary backdrop-blur-sm">
                  Public
                </div>
              )}
            </div>
          ))}
        </div>
      )}

      {editingPhoto && (
        <PhotoEditor
          photo={editingPhoto}
          open={!!editingPhoto}
          onClose={() => setEditingPhoto(null)}
          onSave={() => loadPhotos()}
        />
      )}
    </div>
  )
}
