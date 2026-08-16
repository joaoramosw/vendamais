"use client"

import { useEffect, useState } from "react"
import { useInView } from "react-intersection-observer"

interface AnimatedNumberProps {
  value: number
  duration?: number
  loading?: boolean
}

export function AnimatedNumber({ value, duration = 1000, loading = false }: AnimatedNumberProps) {
  const [displayValue, setDisplayValue] = useState(0)
  const { ref, inView } = useInView({
    triggerOnce: true,
    threshold: 0.1,
  })

  useEffect(() => {
    if (loading || !inView) return

    let startTime: number | null = null
    const startValue = 0

    const animate = (currentTime: number) => {
      if (!startTime) startTime = currentTime
      const progress = Math.min((currentTime - startTime) / duration, 1)

      // Ease out cubic
      const easeProgress = 1 - Math.pow(1 - progress, 3)
      const current = Math.floor(startValue + (value - startValue) * easeProgress)

      setDisplayValue(current)

      if (progress < 1) {
        requestAnimationFrame(animate)
      } else {
        setDisplayValue(value)
      }
    }

    requestAnimationFrame(animate)
  }, [value, duration, inView, loading])

  if (loading) {
    return <div className="h-8 w-16 bg-white/[0.08] animate-pulse rounded-md" />
  }

  return <span ref={ref}>{displayValue}</span>
}
