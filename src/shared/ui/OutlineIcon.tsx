import type { SVGProps } from 'react'

export type OutlineIconName = 'back' | 'fuel' | 'gauge' | 'history' | 'home'

type OutlineIconProps = Omit<SVGProps<SVGSVGElement>, 'children'> & {
  name: OutlineIconName
}

export default function OutlineIcon({
  name,
  className = '',
  ...props
}: OutlineIconProps) {
  return (
    <svg
      aria-hidden="true"
      className={`outline-icon ${className}`.trim()}
      fill="none"
      focusable="false"
      stroke="currentColor"
      strokeLinecap="round"
      strokeLinejoin="round"
      strokeWidth="1.8"
      viewBox="0 0 24 24"
      {...props}
    >
      {name === 'back' && (
        <>
          <path d="M19 12H5" />
          <path d="m11 6-6 6 6 6" />
        </>
      )}
      {name === 'home' && (
        <>
          <path d="m3 10.5 9-7 9 7" />
          <path d="M5 9.5V21h14V9.5" />
          <path d="M9 21v-6h6v6" />
        </>
      )}
      {name === 'history' && (
        <>
          <circle cx="12" cy="12" r="9" />
          <path d="M12 7v5l3 2" />
        </>
      )}
      {name === 'fuel' && (
        <path d="M12 2.8c3 4.1 5.4 7.1 5.4 10.6A5.4 5.4 0 1 1 6.6 13.4C6.6 9.9 9 6.9 12 2.8Z" />
      )}
      {name === 'gauge' && (
        <>
          <path d="M4.2 18a8 8 0 1 1 15.6 0" />
          <path d="m12 13 3.7-3.7" />
          <path d="M7.2 18h9.6" />
        </>
      )}
    </svg>
  )
}
