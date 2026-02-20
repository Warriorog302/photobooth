"use client"

import { useState, useRef, useEffect, useCallback } from "react"
import { Camera, RotateCcw, Download, Save, Sparkles, ImageIcon, Layers } from "lucide-react"
import { Button } from "@/components/ui/button"
import { cn } from "@/lib/utils"
import { type Background, backgroundStore, photoStore } from "@/lib/store"
import { useAuth } from "@/lib/auth-context"

const FILTERS = [
  { name: "None", value: "none" },
  { name: "Sepia", value: "sepia(1)" },
  { name: "B&W", value: "grayscale(1)" },
  { name: "Warm", value: "sepia(0.4) saturate(1.5)" },
  { name: "Cool", value: "saturate(0.8) hue-rotate(20deg)" },
  { name: "Vintage", value: "sepia(0.5) contrast(1.2) brightness(0.9)" },
  { name: "Bright", value: "brightness(1.3) contrast(1.1)" },
  { name: "Dramatic", value: "contrast(1.5) brightness(0.85)" },
]

// ---- Selfie segmentation via BodyPix (loaded from CDN at runtime) ----
// We do NOT use any npm packages for ML segmentation. Everything loads at
// runtime from CDN scripts so the bundler never sees these dependencies.

interface SegmentationEngine {
  segmentPerson: (video: HTMLVideoElement) => Promise<{ data: Uint8Array } | null>
}

async function injectScript(url: string): Promise<void> {
  if (typeof document === "undefined") return
  if (document.querySelector(`script[src="${url}"]`)) return
  return new Promise((resolve, reject) => {
    const el = document.createElement("script")
    el.src = url
    el.async = true
    el.onload = () => resolve()
    el.onerror = () => reject(new Error("Script load failed: " + url))
    document.head.appendChild(el)
  })
}

async function loadSegmentationEngine(): Promise<SegmentationEngine | null> {
  try {
    // Load TF.js + BodyPix from CDN (no npm packages)
    await injectScript("https://cdn.jsdelivr.net/npm/@tensorflow/tfjs@4.22.0/dist/tf.min.js")
    await injectScript("https://cdn.jsdelivr.net/npm/@tensorflow-models/body-pix@2.2.1/dist/body-pix.min.js")

    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    const g = window as any
    if (!g.bodyPix) return null

    const net = await g.bodyPix.load({
      architecture: "MobileNetV1",
      outputStride: 16,
      multiplier: 0.75,
      quantBytes: 2,
    })

    return {
      segmentPerson: async (video: HTMLVideoElement) => {
        try {
          const seg = await net.segmentPerson(video, {
            flipHorizontal: false,
            internalResolution: "medium",
            segmentationThreshold: 0.7,
          })
          return seg
        } catch {
          return null
        }
      },
    }
  } catch (err) {
    console.log("[v0] Segmentation engine failed to load:", err)
    return null
  }
}

export function WebcamCapture() {
  const { user } = useAuth()
  const videoRef = useRef<HTMLVideoElement>(null)
  const canvasRef = useRef<HTMLCanvasElement>(null)
  const hiddenCanvasRef = useRef<HTMLCanvasElement>(null)
  const animationRef = useRef<number>(0)
  const engineRef = useRef<SegmentationEngine | null>(null)

  const [stream, setStream] = useState<MediaStream | null>(null)
  const [capturedImage, setCapturedImage] = useState<string | null>(null)
  const [selectedBg, setSelectedBg] = useState<Background | null>(null)
  const [blurBg, setBlurBg] = useState(false)
  const [selectedFilter, setSelectedFilter] = useState(FILTERS[0])
  const [backgrounds, setBackgrounds] = useState<Background[]>([])
  const [isProcessing, setIsProcessing] = useState(false)
  const [segmenterLoaded, setSegmenterLoaded] = useState(false)
  const [saving, setSaving] = useState(false)
  const [cameraError, setCameraError] = useState<string | null>(null)

  // Load backgrounds from IndexedDB
  useEffect(() => {
    backgroundStore.seed().then(() => {
      backgroundStore.getActive().then(setBackgrounds)
    })
  }, [])

  // Load segmentation engine from CDN
  useEffect(() => {
    let cancelled = false
    loadSegmentationEngine().then((engine) => {
      if (!cancelled && engine) {
        engineRef.current = engine
        setSegmenterLoaded(true)
      }
    })
    return () => { cancelled = true }
  }, [])

  // Start webcam
  const startCamera = useCallback(async () => {
    try {
      setCameraError(null)
      const mediaStream = await navigator.mediaDevices.getUserMedia({
        video: { width: { ideal: 1280 }, height: { ideal: 720 }, facingMode: "user" },
        audio: false,
      })
      setStream(mediaStream)
      if (videoRef.current) {
        videoRef.current.srcObject = mediaStream
      }
    } catch {
      setCameraError("Unable to access camera. Please allow camera permissions.")
    }
  }, [])

  useEffect(() => {
    startCamera()
    return () => {
      if (stream) stream.getTracks().forEach((t) => t.stop())
      if (animationRef.current) cancelAnimationFrame(animationRef.current)
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [])

  // Render loop
  useEffect(() => {
    if (!stream || capturedImage) return

    const video = videoRef.current
    const canvas = canvasRef.current
    const hiddenCanvas = hiddenCanvasRef.current
    if (!video || !canvas || !hiddenCanvas) return

    const ctx = canvas.getContext("2d", { willReadFrequently: true })
    const hiddenCtx = hiddenCanvas.getContext("2d", { willReadFrequently: true })
    if (!ctx || !hiddenCtx) return

    let bgImage: HTMLImageElement | null = null
    if (selectedBg) {
      bgImage = new window.Image()
      bgImage.crossOrigin = "anonymous"
      bgImage.src = selectedBg.image_url
    }

    let running = true
    let processing = false

    const processFrame = async () => {
      if (!running || video.readyState < 2) {
        if (running) animationRef.current = requestAnimationFrame(processFrame)
        return
      }

      const w = video.videoWidth || 640
      const h = video.videoHeight || 480
      canvas.width = w
      canvas.height = h
      hiddenCanvas.width = w
      hiddenCanvas.height = h

      const filterCSS = selectedFilter.value === "none" ? "none" : selectedFilter.value

      const needSegmentation = (selectedBg || blurBg) && engineRef.current
      if (needSegmentation && !processing) {
        processing = true
        try {
          const seg = await engineRef.current!.segmentPerson(video)
          if (seg && seg.data && running) {
            const mask = seg.data // Uint8Array, 0 = bg, 1 = person

            // Draw video frame to hidden canvas
            hiddenCtx.drawImage(video, 0, 0)
            const personFrame = hiddenCtx.getImageData(0, 0, w, h)

            // Draw background to visible canvas
            ctx.save()
            ctx.filter = "none"
            if (blurBg) {
              ctx.filter = "blur(14px)"
              ctx.drawImage(video, 0, 0)
              ctx.filter = "none"
            } else if (bgImage && bgImage.complete && bgImage.naturalWidth > 0) {
              ctx.drawImage(bgImage, 0, 0, w, h)
            } else {
              ctx.fillStyle = "#1a1a2e"
              ctx.fillRect(0, 0, w, h)
            }
            ctx.restore()

            const bgFrame = ctx.getImageData(0, 0, w, h)

            // Composite: overlay person pixels where mask=1
            for (let i = 0; i < mask.length; i++) {
              if (mask[i] === 1) {
                const px = i * 4
                bgFrame.data[px] = personFrame.data[px]
                bgFrame.data[px + 1] = personFrame.data[px + 1]
                bgFrame.data[px + 2] = personFrame.data[px + 2]
                bgFrame.data[px + 3] = 255
              }
            }
            ctx.putImageData(bgFrame, 0, 0)

            // Apply filter on top by redrawing composited image through filter
            if (filterCSS !== "none") {
              hiddenCtx.drawImage(canvas, 0, 0)
              ctx.filter = filterCSS
              ctx.drawImage(hiddenCanvas, 0, 0)
              ctx.filter = "none"
            }
          } else {
            ctx.filter = filterCSS
            ctx.drawImage(video, 0, 0)
            ctx.filter = "none"
          }
        } catch {
          ctx.filter = filterCSS
          ctx.drawImage(video, 0, 0)
          ctx.filter = "none"
        }
        processing = false
      } else if (!needSegmentation) {
        // No segmentation needed – just draw video with filter
        ctx.filter = filterCSS
        ctx.drawImage(video, 0, 0)
        ctx.filter = "none"
      }
      // If segmentation is in progress, skip this frame (previous composite stays on-screen)

      if (running) animationRef.current = requestAnimationFrame(processFrame)
    }

    processFrame()
    return () => {
      running = false
      if (animationRef.current) cancelAnimationFrame(animationRef.current)
    }
  }, [stream, capturedImage, selectedBg, blurBg, selectedFilter])

  const capturePhoto = () => {
    const canvas = canvasRef.current
    if (!canvas) return
    setIsProcessing(true)
    const dataUrl = canvas.toDataURL("image/png")
    setCapturedImage(dataUrl)
    setIsProcessing(false)
  }

  const retake = () => setCapturedImage(null)

  const savePhoto = async () => {
    if (!capturedImage || !user) return
    setSaving(true)
    await photoStore.create({
      id: crypto.randomUUID(),
      image_url: capturedImage,
      is_public: false,
      created_date: new Date().toISOString(),
      created_by: user.id,
    })
    setSaving(false)
    setCapturedImage(null)
  }

  const downloadPhoto = () => {
    if (!capturedImage) return
    const link = document.createElement("a")
    link.href = capturedImage
    link.download = `photobooth-${Date.now()}.png`
    link.click()
  }

  return (
    <div className="flex flex-col gap-6">
      {/* Viewfinder */}
      <div className="relative mx-auto w-full max-w-2xl overflow-hidden rounded-2xl border border-border bg-card shadow-2xl">
        <div className="relative aspect-video bg-secondary">
          {cameraError ? (
            <div className="flex h-full flex-col items-center justify-center gap-4 p-8 text-center">
              <Camera className="size-16 text-muted-foreground" />
              <p className="text-muted-foreground">{cameraError}</p>
              <Button onClick={startCamera} variant="outline">Try Again</Button>
            </div>
          ) : capturedImage ? (
            /* eslint-disable-next-line @next/next/no-img-element */
            <img src={capturedImage} alt="Captured photo" className="size-full object-cover" />
          ) : (
            <>
              <video
                ref={videoRef}
                autoPlay
                playsInline
                muted
                className="absolute inset-0 size-full object-cover opacity-0"
                onLoadedMetadata={() => videoRef.current?.play()}
              />
              <canvas ref={canvasRef} className="size-full object-cover" />
              <canvas ref={hiddenCanvasRef} className="hidden" />
            </>
          )}

          {/* Corner brackets */}
          {!capturedImage && !cameraError && (
            <div className="pointer-events-none absolute inset-6">
              <div className="absolute left-0 top-0 size-8 border-l-2 border-t-2 border-primary/60 rounded-tl-sm" />
              <div className="absolute right-0 top-0 size-8 border-r-2 border-t-2 border-primary/60 rounded-tr-sm" />
              <div className="absolute bottom-0 left-0 size-8 border-b-2 border-l-2 border-primary/60 rounded-bl-sm" />
              <div className="absolute bottom-0 right-0 size-8 border-b-2 border-r-2 border-primary/60 rounded-br-sm" />
            </div>
          )}

          {/* AI badge */}
          {segmenterLoaded && !capturedImage && (
            <div className="absolute left-3 top-3 flex items-center gap-1.5 rounded-full bg-primary/20 px-3 py-1 text-xs font-medium text-primary backdrop-blur-sm">
              <Sparkles className="size-3" />
              AI Ready
            </div>
          )}
        </div>
      </div>

      {/* Capture / Action buttons */}
      <div className="flex items-center justify-center gap-4">
        {capturedImage ? (
          <>
            <Button variant="outline" onClick={retake} className="gap-2">
              <RotateCcw className="size-4" /> Retake
            </Button>
            <Button variant="outline" onClick={downloadPhoto} className="gap-2">
              <Download className="size-4" /> Download
            </Button>
            {user && (
              <Button onClick={savePhoto} disabled={saving} className="gap-2 bg-primary text-primary-foreground hover:bg-primary/90">
                <Save className="size-4" /> {saving ? "Saving..." : "Save to Gallery"}
              </Button>
            )}
          </>
        ) : (
          <Button
            onClick={capturePhoto}
            disabled={isProcessing || !!cameraError}
            className="size-16 rounded-full bg-primary text-primary-foreground shadow-lg shadow-primary/25 hover:bg-primary/90 hover:scale-105 transition-transform"
          >
            <Camera className="size-7" />
            <span className="sr-only">Capture Photo</span>
          </Button>
        )}
      </div>

      {/* Background & Filter selectors */}
      {!capturedImage && (
        <div className="mx-auto w-full max-w-2xl space-y-4">
          {/* Background selector */}
          <div className="space-y-2">
            <div className="flex items-center gap-2 text-sm font-medium text-muted-foreground">
              <ImageIcon className="size-4" /> Background
            </div>
            <div className="flex gap-2 overflow-x-auto pb-2">
              <button
                onClick={() => { setSelectedBg(null); setBlurBg(false) }}
                className={cn(
                  "flex shrink-0 flex-col items-center gap-1 rounded-xl border-2 p-1.5 transition-all",
                  !selectedBg && !blurBg ? "border-primary bg-primary/10" : "border-border hover:border-muted-foreground"
                )}
              >
                <div className="flex size-14 items-center justify-center rounded-lg bg-secondary text-xs text-muted-foreground">None</div>
              </button>
              <button
                onClick={() => { setSelectedBg(null); setBlurBg(true) }}
                className={cn(
                  "flex shrink-0 flex-col items-center gap-1 rounded-xl border-2 p-1.5 transition-all",
                  blurBg ? "border-primary bg-primary/10" : "border-border hover:border-muted-foreground"
                )}
              >
                <div className="flex size-14 items-center justify-center rounded-lg bg-secondary text-xs text-muted-foreground">
                  <Layers className="size-5" />
                </div>
              </button>
              {backgrounds.map((bg) => (
                <button
                  key={bg.id}
                  onClick={() => { setSelectedBg(bg); setBlurBg(false) }}
                  className={cn(
                    "flex shrink-0 flex-col items-center gap-1 rounded-xl border-2 p-1.5 transition-all",
                    selectedBg?.id === bg.id ? "border-primary bg-primary/10" : "border-border hover:border-muted-foreground"
                  )}
                >
                  {/* eslint-disable-next-line @next/next/no-img-element */}
                  <img src={bg.image_url} alt={bg.name} className="size-14 rounded-lg object-cover" />
                </button>
              ))}
            </div>
          </div>

          {/* Filter selector */}
          <div className="space-y-2">
            <div className="flex items-center gap-2 text-sm font-medium text-muted-foreground">
              <Sparkles className="size-4" /> Filter
            </div>
            <div className="flex gap-2 overflow-x-auto pb-2">
              {FILTERS.map((filter) => (
                <button
                  key={filter.name}
                  onClick={() => setSelectedFilter(filter)}
                  className={cn(
                    "shrink-0 rounded-lg border-2 px-4 py-2 text-xs font-medium transition-all",
                    selectedFilter.name === filter.name
                      ? "border-primary bg-primary/10 text-primary"
                      : "border-border text-muted-foreground hover:border-muted-foreground hover:text-foreground"
                  )}
                >
                  {filter.name}
                </button>
              ))}
            </div>
          </div>
        </div>
      )}
    </div>
  )
}
