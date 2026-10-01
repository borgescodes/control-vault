import type { SVGProps } from 'react'

export type VehicleIconName = 'back' | 'fuel' | 'gauge' | 'history' | 'home' | 'route'

type VehicleIconProps = Omit<SVGProps<SVGSVGElement>, 'children'> & {
  name: VehicleIconName
}

export default function VehicleIcon({
  name,
  className = '',
  ...props
}: VehicleIconProps) {
  const filled = name !== 'back'

  return (
    <svg
      aria-hidden="true"
      className={`vehicle-icon ${className}`.trim()}
      data-icon={name}
      fill={filled ? 'currentColor' : 'none'}
      focusable="false"
      stroke={filled ? undefined : 'currentColor'}
      strokeLinecap={filled ? undefined : 'round'}
      strokeLinejoin={filled ? undefined : 'round'}
      strokeWidth={filled ? undefined : '1.8'}
      viewBox="0 0 24 24"
      {...props}
    >
      {name === 'back' && (
        <>
          <path d="M19 12H5" />
          <path d="m11 6-6 6 6 6" />
        </>
      )}
      {name === 'gauge' && (
        <path d="m5.08,20h13.85c.71,0,1.37-.37,1.72-.97,1.09-1.87,1.54-4.02,1.29-6.2-.52-4.58-4.23-8.26-8.81-8.77-2.84-.31-5.68.6-7.8,2.49-2.11,1.9-3.33,4.61-3.33,7.45,0,1.77.47,3.51,1.36,5.03.35.6,1.01.97,1.72.97Zm5.86-7.06l6.04-3.96s.04,0,.04.01c0,.01,0,.02,0,.03l-3.96,6.04s0,0,0,0c-.46.71-1.41.9-2.12.44-.18-.12-.33-.27-.44-.44-.46-.71-.26-1.66.44-2.12Z" />
      )}
      {name === 'fuel' && (
        <path d="m16.62,3.22l-1.25,1.56,3.87,3.1c.48.38.75.95.75,1.56v8.56c0,.55-.45,1-1,1s-1-.45-1-1v-3c0-1.65-1.35-3-3-3h-1v-7c0-1.1-.9-2-2-2H4c-1.1,0-2,.9-2,2v14c0,1.1.9,2,2,2h8c1.1,0,2-.9,2-2v-5h1c.55,0,1,.45,1,1v3c0,1.65,1.35,3,3,3s3-1.35,3-3v-8.56c0-1.22-.55-2.36-1.5-3.12l-3.87-3.1Zm-12.62,1.78h8v4s0,0,0,0H4v-4Z" />
      )}
      {name === 'home' && (
        <path d="M3 13h1v7c0 1.1.9 2 2 2h12c1.1 0 2-.9 2-2v-7h1c.4 0 .77-.24.92-.62.16-.37.07-.8-.22-1.09l-8.99-9a.996.996 0 0 0-1.41 0l-9.01 9c-.29.29-.37.72-.22 1.09s.52.62.92.62Z" />
      )}
      {name === 'history' && (
        <path d="M5 2H4v2h1v1c0 2.46 1.32 4.77 3.43 6.02.35.21.57.55.57.9v.16c0 .35-.21.69-.57.9A7.01 7.01 0 0 0 5 19v1H4v2h16v-2h-1v-1c0-2.46-1.32-4.77-3.43-6.02-.36-.21-.57-.55-.57-.9v-.16c0-.35.21-.69.57-.9A7.01 7.01 0 0 0 19 5V4h1V2z" />
      )}
      {name === 'route' && (
        <>
          <path d="m17.5,11H6.5c-1.38,0-2.5-1.12-2.5-2.5s1.12-2.5,2.5-2.5h3.5v2l4-3-4-3v2h-3.5c-2.48,0-4.5,2.02-4.5,4.5s2.02,4.5,4.5,4.5h11c1.38,0,2.5,1.12,2.5,2.5s-1.12,2.5-2.5,2.5H7.82c-.41-1.16-1.51-2-2.82-2-1.65,0-3,1.35-3,3s1.35,3,3,3c1.3,0,2.4-.84,2.82-2h9.68c2.48,0,4.5-2.02,4.5-4.5s-2.02-4.5-4.5-4.5Z" />
          <path d="M19 2A3 3 0 1 0 19 8 3 3 0 1 0 19 2z" />
        </>
      )}
    </svg>
  )
}
