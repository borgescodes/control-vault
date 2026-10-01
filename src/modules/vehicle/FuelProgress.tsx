import { useEffect, useRef, useState } from 'react'

export default function FuelProgress({ percent }: { percent: number }) {
  const track = useRef<HTMLDivElement>(null)
  const [running, setRunning] = useState(false)
  const hasFuel = percent > 0

  useEffect(() => {
    const media = typeof matchMedia === 'function'
      ? matchMedia('(prefers-reduced-motion: reduce)')
      : null
    let visible = typeof IntersectionObserver !== 'function'
    const update = () => setRunning(hasFuel && visible && !document.hidden && !media?.matches)
    const observer = typeof IntersectionObserver === 'function'
      ? new IntersectionObserver(([entry]) => { visible = entry.isIntersecting; update() })
      : null
    if (track.current) observer?.observe(track.current)
    document.addEventListener('visibilitychange', update)
    media?.addEventListener('change', update)
    update()
    return () => {
      observer?.disconnect()
      document.removeEventListener('visibilitychange', update)
      media?.removeEventListener('change', update)
    }
  }, [hasFuel])

  return (
    <div
      aria-label={`Combustível: ${Math.round(percent)}%`}
      aria-valuemax={100}
      aria-valuemin={0}
      aria-valuenow={Math.round(percent)}
      className="fuel-progress"
      data-motion={running ? 'running' : 'paused'}
      ref={track}
      role="progressbar"
    >
      <div className="fuel-progress__value" style={{ width: `${percent}%` }} />
      <span aria-hidden="true" className="fuel-progress__tick fuel-progress__tick--one" />
      <span aria-hidden="true" className="fuel-progress__tick fuel-progress__tick--two" />
      <span aria-hidden="true" className="fuel-progress__tick fuel-progress__tick--three" />
    </div>
  )
}
