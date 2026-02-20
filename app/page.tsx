"use client"

import { Camera, Sparkles, ImageIcon, Palette } from "lucide-react"
import { Button } from "@/components/ui/button"
import { useAuth } from "@/lib/auth-context"
import { WebcamCapture } from "@/components/webcam-capture"
import Link from "next/link"

function LandingPage() {
  return (
    <div className="flex flex-1 flex-col items-center justify-center px-4 py-16">
      <div className="mx-auto max-w-2xl text-center">
        <div className="mb-6 inline-flex items-center gap-2 rounded-full bg-primary/10 px-4 py-2 text-sm font-medium text-primary">
          <Sparkles className="size-4" />
          AI-Powered Photo Booth
        </div>
        <h1 className="mb-4 text-balance text-5xl font-bold tracking-tight text-foreground sm:text-6xl">
          Capture moments with stunning backgrounds
        </h1>
        <p className="mb-10 text-pretty text-lg text-muted-foreground leading-relaxed">
          Step into our virtual photo booth. Replace your background in real-time with AI,
          apply filters, and create unforgettable photos.
        </p>
        <div className="flex flex-wrap items-center justify-center gap-4">
          <Link href="/auth/signup">
            <Button size="lg" className="gap-2 bg-primary text-primary-foreground hover:bg-primary/90">
              <Camera className="size-5" />
              Get Started
            </Button>
          </Link>
          <Link href="/auth/login">
            <Button size="lg" variant="outline" className="gap-2">
              Sign In
            </Button>
          </Link>
        </div>
      </div>

      {/* Feature cards */}
      <div className="mx-auto mt-20 grid max-w-4xl gap-6 sm:grid-cols-3">
        {[
          {
            icon: Sparkles,
            title: "AI Backgrounds",
            desc: "Real-time background replacement powered by machine learning",
          },
          {
            icon: Palette,
            title: "Creative Filters",
            desc: "Apply stunning filters like Sepia, B&W, Vintage, and more",
          },
          {
            icon: ImageIcon,
            title: "Photo Editor",
            desc: "Crop, rotate, and adjust brightness, contrast, and saturation",
          },
        ].map((feature) => (
          <div
            key={feature.title}
            className="flex flex-col items-center gap-3 rounded-2xl border border-border bg-card p-6 text-center"
          >
            <div className="flex size-12 items-center justify-center rounded-xl bg-primary/10">
              <feature.icon className="size-6 text-primary" />
            </div>
            <h3 className="text-base font-semibold text-foreground">{feature.title}</h3>
            <p className="text-sm text-muted-foreground leading-relaxed">{feature.desc}</p>
          </div>
        ))}
      </div>
    </div>
  )
}

export default function HomePage() {
  const { user, loading } = useAuth()

  if (loading) {
    return (
      <div className="flex flex-1 items-center justify-center">
        <div className="size-8 animate-spin rounded-full border-2 border-primary border-t-transparent" />
      </div>
    )
  }

  if (!user) {
    return <LandingPage />
  }

  return (
    <div className="mx-auto w-full max-w-4xl px-4 py-8">
      <div className="mb-8 text-center">
        <h1 className="text-3xl font-bold tracking-tight text-foreground">Photo Booth</h1>
        <p className="mt-2 text-muted-foreground">
          Choose a background, pick a filter, and strike a pose
        </p>
      </div>
      <WebcamCapture />
    </div>
  )
}
