import { useEffect, useRef, useState } from 'react'

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
  const [systemReduce, setSystemReduce] = useState(prefersReducedMotion)
  const reduce = reducedMotion ?? systemReduce
  const [displayed, setDisplayed] = useState(value)
  const current = useRef(0)

  useEffect(() => {
    if (typeof matchMedia !== 'function') return
    const media = matchMedia('(prefers-reduced-motion: reduce)')
    const update = () => setSystemReduce(media.matches)
    media.addEventListener('change', update)
    update()
    return () => media.removeEventListener('change', update)
  }, [])

  useEffect(() => {
    if (reduce || document.hidden) {
      current.current = value
      setDisplayed(value)
      return
    }

    const from = current.current
    setDisplayed(from)
    const start = performance.now()
    let frame = 0
    const tick = (time: number) => {
      const raw = Math.min(1, Math.max(0, (time - start) / COUNT_UP_MS))
      const eased = 1 - Math.pow(1 - raw, 3)
      current.current = from + (value - from) * eased
      setDisplayed(current.current)
      if (raw < 1) frame = requestAnimationFrame(tick)
      else setDisplayed(value)
    }
    const finishWhenHidden = () => {
      if (!document.hidden) return
      cancelAnimationFrame(frame)
      current.current = value
      setDisplayed(value)
    }
    document.addEventListener('visibilitychange', finishWhenHidden)
    frame = requestAnimationFrame(tick)
    return () => {
      cancelAnimationFrame(frame)
      document.removeEventListener('visibilitychange', finishWhenHidden)
    }
  }, [reduce, value])

  return <span className={className}>{format(displayed)}</span>
}
