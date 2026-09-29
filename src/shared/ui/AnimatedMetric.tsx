import { useEffect, useState } from 'react'

export const COUNT_UP_MS = 880

type AnimatedMetricProps = {
  value: number
  format: (value: number) => string
  className?: string
  reducedMotion?: boolean
}

function prefersReducedMotion() {
  return (
    typeof matchMedia === 'function' &&
    matchMedia('(prefers-reduced-motion: reduce)').matches
  )
}

export default function AnimatedMetric({
  value,
  format,
  className,
  reducedMotion,
}: AnimatedMetricProps) {
  const reduce = reducedMotion ?? prefersReducedMotion()
  const [displayed, setDisplayed] = useState(reduce ? value : 0)

  useEffect(() => {
    if (reduce) {
      setDisplayed(value)
      return
    }

    setDisplayed(0)
    const start = performance.now()
    let frame = 0
    const tick = (time: number) => {
      const raw = Math.min(1, Math.max(0, (time - start) / COUNT_UP_MS))
      const eased = 1 - Math.pow(1 - raw, 3)
      setDisplayed(value * eased)
      if (raw < 1) frame = requestAnimationFrame(tick)
      else setDisplayed(value)
    }
    frame = requestAnimationFrame(tick)
    return () => cancelAnimationFrame(frame)
  }, [reduce, value])

  return <span className={className}>{format(displayed)}</span>
}
