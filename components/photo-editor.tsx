"use client"

import { useState, useRef, useEffect, useCallback } from "react"
import {
  RotateCw,
  Crop,
  Sun,
  Contrast,
  Droplets,
  Undo2,
  Redo2,
  Save,
  X,
} from "lucide-react"
import { Button } from "@/components/ui/button"
import { Slider } from "@/components/ui/slider"
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog"
import { type Photo, photoStore } from "@/lib/store"

interface PhotoEditorProps {
  photo: Photo
  open: boolean
  onClose: () => void
  onSave: () => void
}

interface EditorState {
  brightness: number
  contrast: number
  saturation: number
  rotation: number
  cropArea: { x: number; y: number; w: number; h: number } | null
}

const defaultState: EditorState = {
  brightness: 100,
  contrast: 100,
  saturation: 100,
  rotation: 0,
  cropArea: null,
}

export function PhotoEditor({ photo, open, onClose, onSave }: PhotoEditorProps) {
  const canvasRef = useRef<HTMLCanvasElement>(null)
  const imageRef = useRef<HTMLImageElement | null>(null)
  const containerRef = useRef<HTMLDivElement>(null)

  const [state, setState] = useState<EditorState>({ ...defaultState })
  const [history, setHistory] = useState<EditorState[]>([{ ...defaultState }])
  const [historyIndex, setHistoryIndex] = useState(0)
  const [isCropping, setIsCropping] = useState(false)
  const [cropStart, setCropStart] = useState<{ x: number; y: number } | null>(null)
  const [cropEnd, setCropEnd] = useState<{ x: number; y: number } | null>(null)
  const [saving, setSaving] = useState(false)

  // Load image
  useEffect(() => {
    if (!open) return
    const img = new window.Image()
    img.crossOrigin = "anonymous"
    img.onload = () => {
      imageRef.current = img
      renderCanvas(state)
    }
    img.src = photo.image_url
    setState({ ...defaultState })
    setHistory([{ ...defaultState }])
    setHistoryIndex(0)
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [open, photo.image_url])

  const renderCanvas = useCallback(
    (editorState: EditorState) => {
      const canvas = canvasRef.current
      const img = imageRef.current
      if (!canvas || !img) return

      const ctx = canvas.getContext("2d")
      if (!ctx) return

      const rotated = editorState.rotation % 180 !== 0
      canvas.width = rotated ? img.height : img.width
      canvas.height = rotated ? img.width : img.height

      ctx.clearRect(0, 0, canvas.width, canvas.height)
      ctx.save()
      ctx.translate(canvas.width / 2, canvas.height / 2)
      ctx.rotate((editorState.rotation * Math.PI) / 180)
      ctx.filter = `brightness(${editorState.brightness}%) contrast(${editorState.contrast}%) saturate(${editorState.saturation}%)`
      ctx.drawImage(img, -img.width / 2, -img.height / 2)
      ctx.restore()
    },
    []
  )

  useEffect(() => {
    if (imageRef.current) {
      renderCanvas(state)
    }
  }, [state, renderCanvas])

  const pushHistory = (newState: EditorState) => {
    const newHistory = history.slice(0, historyIndex + 1)
    newHistory.push(newState)
    setHistory(newHistory)
    setHistoryIndex(newHistory.length - 1)
    setState(newState)
  }

  const undo = () => {
    if (historyIndex > 0) {
      const newIndex = historyIndex - 1
      setHistoryIndex(newIndex)
      setState(history[newIndex])
    }
  }

  const redo = () => {
    if (historyIndex < history.length - 1) {
      const newIndex = historyIndex + 1
      setHistoryIndex(newIndex)
      setState(history[newIndex])
    }
  }

  const rotate = () => {
    pushHistory({ ...state, rotation: (state.rotation + 90) % 360 })
  }

  const applyCrop = () => {
    if (!cropStart || !cropEnd || !canvasRef.current || !imageRef.current) return

    const canvas = canvasRef.current
    const rect = canvas.getBoundingClientRect()
    const scaleX = canvas.width / rect.width
    const scaleY = canvas.height / rect.height

    const x = Math.min(cropStart.x, cropEnd.x) * scaleX
    const y = Math.min(cropStart.y, cropEnd.y) * scaleY
    const w = Math.abs(cropEnd.x - cropStart.x) * scaleX
    const h = Math.abs(cropEnd.y - cropStart.y) * scaleY

    if (w < 10 || h < 10) {
      setIsCropping(false)
      setCropStart(null)
      setCropEnd(null)
      return
    }

    const ctx = canvas.getContext("2d")
    if (!ctx) return

    const imageData = ctx.getImageData(x, y, w, h)
    const tempCanvas = document.createElement("canvas")
    tempCanvas.width = w
    tempCanvas.height = h
    const tempCtx = tempCanvas.getContext("2d")
    if (!tempCtx) return
    tempCtx.putImageData(imageData, 0, 0)

    const croppedImg = new window.Image()
    croppedImg.crossOrigin = "anonymous"
    croppedImg.onload = () => {
      imageRef.current = croppedImg
      const newState = { ...state, rotation: 0 }
      pushHistory(newState)
      renderCanvas(newState)
    }
    croppedImg.src = tempCanvas.toDataURL()

    setIsCropping(false)
    setCropStart(null)
    setCropEnd(null)
  }

  const handleCropMouseDown = (e: React.MouseEvent<HTMLCanvasElement>) => {
    if (!isCropping) return
    const rect = canvasRef.current!.getBoundingClientRect()
    setCropStart({ x: e.clientX - rect.left, y: e.clientY - rect.top })
    setCropEnd(null)
  }

  const handleCropMouseMove = (e: React.MouseEvent<HTMLCanvasElement>) => {
    if (!isCropping || !cropStart) return
    const rect = canvasRef.current!.getBoundingClientRect()
    setCropEnd({ x: e.clientX - rect.left, y: e.clientY - rect.top })
  }

  const handleCropMouseUp = () => {
    if (!isCropping || !cropStart || !cropEnd) return
    applyCrop()
  }

  const handleSave = async () => {
    const canvas = canvasRef.current
    if (!canvas) return
    setSaving(true)
    const dataUrl = canvas.toDataURL("image/png")
    await photoStore.update({ ...photo, image_url: dataUrl })
    setSaving(false)
    onSave()
    onClose()
  }

  return (
    <Dialog open={open} onOpenChange={(o) => !o && onClose()}>
      <DialogContent className="max-w-4xl bg-card" showCloseButton={false}>
        <DialogHeader>
          <div className="flex items-center justify-between">
            <DialogTitle className="text-foreground">Edit Photo</DialogTitle>
            <Button variant="ghost" size="icon" onClick={onClose}>
              <X className="size-4" />
            </Button>
          </div>
        </DialogHeader>

        <div className="flex flex-col gap-4 lg:flex-row">
          {/* Canvas area */}
          <div
            ref={containerRef}
            className="relative flex-1 overflow-hidden rounded-xl bg-secondary"
          >
            <canvas
              ref={canvasRef}
              className="mx-auto max-h-[50vh] w-full cursor-crosshair object-contain"
              onMouseDown={handleCropMouseDown}
              onMouseMove={handleCropMouseMove}
              onMouseUp={handleCropMouseUp}
            />
            {/* Crop overlay */}
            {isCropping && cropStart && cropEnd && (
              <div
                className="absolute border-2 border-dashed border-primary bg-primary/10"
                style={{
                  left: Math.min(cropStart.x, cropEnd.x),
                  top: Math.min(cropStart.y, cropEnd.y),
                  width: Math.abs(cropEnd.x - cropStart.x),
                  height: Math.abs(cropEnd.y - cropStart.y),
                }}
              />
            )}
          </div>

          {/* Controls */}
          <div className="flex w-full flex-col gap-4 lg:w-64">
            {/* Undo/Redo */}
            <div className="flex gap-2">
              <Button variant="outline" size="sm" onClick={undo} disabled={historyIndex === 0} className="flex-1 gap-1.5">
                <Undo2 className="size-3.5" /> Undo
              </Button>
              <Button variant="outline" size="sm" onClick={redo} disabled={historyIndex === history.length - 1} className="flex-1 gap-1.5">
                <Redo2 className="size-3.5" /> Redo
              </Button>
            </div>

            {/* Tool buttons */}
            <div className="flex gap-2">
              <Button variant="outline" size="sm" onClick={rotate} className="flex-1 gap-1.5">
                <RotateCw className="size-3.5" /> Rotate
              </Button>
              <Button
                variant={isCropping ? "default" : "outline"}
                size="sm"
                onClick={() => setIsCropping(!isCropping)}
                className="flex-1 gap-1.5"
              >
                <Crop className="size-3.5" /> Crop
              </Button>
            </div>

            {isCropping && (
              <p className="text-xs text-muted-foreground text-center">
                Click and drag on the image to select crop area
              </p>
            )}

            {/* Adjustment sliders */}
            <div className="space-y-4">
              <div className="space-y-2">
                <div className="flex items-center justify-between text-sm">
                  <div className="flex items-center gap-1.5 text-muted-foreground">
                    <Sun className="size-3.5" /> Brightness
                  </div>
                  <span className="text-xs text-foreground">{state.brightness}%</span>
                </div>
                <Slider
                  value={[state.brightness]}
                  min={20}
                  max={200}
                  step={1}
                  onValueChange={([v]) => pushHistory({ ...state, brightness: v })}
                />
              </div>
              <div className="space-y-2">
                <div className="flex items-center justify-between text-sm">
                  <div className="flex items-center gap-1.5 text-muted-foreground">
                    <Contrast className="size-3.5" /> Contrast
                  </div>
                  <span className="text-xs text-foreground">{state.contrast}%</span>
                </div>
                <Slider
                  value={[state.contrast]}
                  min={20}
                  max={200}
                  step={1}
                  onValueChange={([v]) => pushHistory({ ...state, contrast: v })}
                />
              </div>
              <div className="space-y-2">
                <div className="flex items-center justify-between text-sm">
                  <div className="flex items-center gap-1.5 text-muted-foreground">
                    <Droplets className="size-3.5" /> Saturation
                  </div>
                  <span className="text-xs text-foreground">{state.saturation}%</span>
                </div>
                <Slider
                  value={[state.saturation]}
                  min={0}
                  max={200}
                  step={1}
                  onValueChange={([v]) => pushHistory({ ...state, saturation: v })}
                />
              </div>
            </div>

            {/* Save */}
            <Button
              onClick={handleSave}
              disabled={saving}
              className="mt-auto w-full gap-2 bg-primary text-primary-foreground hover:bg-primary/90"
            >
              <Save className="size-4" />
              {saving ? "Saving..." : "Save Changes"}
            </Button>
          </div>
        </div>
      </DialogContent>
    </Dialog>
  )
}
