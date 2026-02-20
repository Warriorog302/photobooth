"use client"

import { useState, useEffect, useRef } from "react"
import { Upload, Trash2, ImageIcon, ToggleLeft, ToggleRight } from "lucide-react"
import { Button } from "@/components/ui/button"
import { type Background, backgroundStore } from "@/lib/store"
import { cn } from "@/lib/utils"

export function BackgroundsManager() {
  const [backgrounds, setBackgrounds] = useState<Background[]>([])
  const [uploading, setUploading] = useState(false)
  const fileInputRef = useRef<HTMLInputElement>(null)

  const loadBackgrounds = async () => {
    await backgroundStore.seed()
    const bgs = await backgroundStore.getAll()
    setBackgrounds(bgs)
  }

  useEffect(() => {
    loadBackgrounds()
  }, [])

  const handleUpload = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0]
    if (!file) return
    setUploading(true)

    const reader = new FileReader()
    reader.onload = async () => {
      const bg: Background = {
        id: crypto.randomUUID(),
        name: file.name.replace(/\.[^.]+$/, ""),
        image_url: reader.result as string,
        is_active: true,
      }
      await backgroundStore.create(bg)
      await loadBackgrounds()
      setUploading(false)
    }
    reader.readAsDataURL(file)
    if (fileInputRef.current) fileInputRef.current.value = ""
  }

  const toggleActive = async (bg: Background) => {
    await backgroundStore.update({ ...bg, is_active: !bg.is_active })
    await loadBackgrounds()
  }

  const deleteBg = async (id: string) => {
    await backgroundStore.delete(id)
    await loadBackgrounds()
  }

  return (
    <div className="space-y-4">
      <div className="flex items-center justify-between">
        <h3 className="text-lg font-semibold text-foreground">Virtual Backgrounds</h3>
        <Button
          onClick={() => fileInputRef.current?.click()}
          disabled={uploading}
          size="sm"
          className="gap-2 bg-primary text-primary-foreground hover:bg-primary/90"
        >
          <Upload className="size-4" />
          {uploading ? "Uploading..." : "Upload"}
        </Button>
        <input
          ref={fileInputRef}
          type="file"
          accept="image/*"
          onChange={handleUpload}
          className="hidden"
          aria-label="Upload background image"
        />
      </div>

      {backgrounds.length === 0 ? (
        <div className="flex flex-col items-center gap-3 rounded-xl border border-dashed border-border py-12 text-center">
          <ImageIcon className="size-10 text-muted-foreground" />
          <p className="text-sm text-muted-foreground">No backgrounds yet. Upload one to get started.</p>
        </div>
      ) : (
        <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-3">
          {backgrounds.map((bg) => (
            <div
              key={bg.id}
              className={cn(
                "group relative overflow-hidden rounded-xl border-2 transition-all",
                bg.is_active ? "border-primary/40" : "border-border opacity-60"
              )}
            >
              {/* eslint-disable-next-line @next/next/no-img-element */}
              <img
                src={bg.image_url}
                alt={bg.name}
                className="aspect-video w-full object-cover"
              />
              <div className="flex items-center justify-between bg-card px-3 py-2">
                <span className="truncate text-sm font-medium text-foreground">{bg.name}</span>
                <div className="flex items-center gap-1">
                  <Button
                    variant="ghost"
                    size="icon"
                    className="size-8 text-muted-foreground hover:text-foreground"
                    onClick={() => toggleActive(bg)}
                    title={bg.is_active ? "Deactivate" : "Activate"}
                  >
                    {bg.is_active ? <ToggleRight className="size-4 text-primary" /> : <ToggleLeft className="size-4" />}
                  </Button>
                  <Button
                    variant="ghost"
                    size="icon"
                    className="size-8 text-muted-foreground hover:text-destructive"
                    onClick={() => deleteBg(bg.id)}
                    title="Delete"
                  >
                    <Trash2 className="size-4" />
                  </Button>
                </div>
              </div>
            </div>
          ))}
        </div>
      )}
    </div>
  )
}
