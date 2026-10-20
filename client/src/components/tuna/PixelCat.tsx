import { useEffect, useState, type CSSProperties, type ReactNode } from 'react'
import { cn } from '@/lib/utils'
import { FAMILY, FRAMES, HAT_SPOT, HATS, PALETTE, SPOTS, TOYS, type Frame } from './frames'

export type HatName = keyof typeof HATS
export type Toy = keyof typeof TOYS

// one path per color, each run of a row's pixels a rectangle (`M x y h n v 1 h -n z`); a grid's
// paths are worked out once
const cache = new Map<readonly string[], { fill: string; d: string }[]>()
export function toPaths(grid: readonly string[]) {
  let paths = cache.get(grid)
  if (paths) return paths
  const d: Record<string, string> = {}
  grid.forEach((row, y) => {
    for (let x = 0; x < row.length;) {
      const c = row[x]
      let n = 1
      while (row[x + n] === c) n++
      if (c !== '.') d[c] = (d[c] ?? '') + `M${x} ${y}h${n}v1h-${n}z`
      x += n
    }
  })
  paths = Object.entries(d).map(([c, path]) => ({ fill: PALETTE[c], d: path }))
  cache.set(grid, paths)
  return paths
}

// a pixel grid as crisp SVG, `scale` screen pixels per grid pixel
export function PixelSprite({
  grid,
  scale = 3,
  className,
  style,
}: {
  grid: readonly string[]
  scale?: number
  className?: string
  style?: CSSProperties
}) {
  const w = grid[0].length
  const h = grid.length
  return (
    <svg
      viewBox={`0 0 ${w} ${h}`}
      width={w * scale}
      height={h * scale}
      shapeRendering="crispEdges"
      className={className}
      style={style}
      aria-hidden
    >
      {toPaths(grid).map((p) => (
        <path key={p.fill} fill={p.fill} d={p.d} />
      ))}
    </svg>
  )
}

export const Toy = ({
  toy,
  scale = 3,
  className,
  style,
}: {
  toy: Toy
  scale?: number
  className?: string
  style?: CSSProperties
}) => <PixelSprite grid={TOYS[toy]} scale={scale} className={className} style={style} />

// Tuna in a pose, with a hat; flip turns her to face left (the walking frames face right). The
// hat sits on her head or her ear, wherever the pose has them; children go on top (a bubble, hearts)
export function PixelCat({
  frame,
  hat,
  scale = 3,
  flip = false,
  className,
  children,
}: {
  frame: Frame
  hat?: HatName | ''
  scale?: number
  flip?: boolean
  className?: string
  children?: ReactNode
}) {
  const grid = FRAMES[frame]
  const hatGrid = hat ? HATS[hat] : null
  let hatStyle: CSSProperties | undefined
  if (hat && hatGrid) {
    const [ax, ay] = SPOTS[FAMILY[frame]][HAT_SPOT[hat]]
    hatStyle = {
      position: 'absolute',
      left: (ax - Math.floor(hatGrid[0].length / 2)) * scale,
      top: (ay - hatGrid.length + 1) * scale,
    }
  }
  return (
    <span
      className={cn('relative inline-block', className)}
      style={{ width: grid[0].length * scale, height: grid.length * scale }}
    >
      <span className="absolute inset-0" style={flip ? { transform: 'scaleX(-1)' } : undefined}>
        <PixelSprite grid={grid} scale={scale} className="block" />
        {hatGrid && <PixelSprite grid={hatGrid} scale={scale} style={hatStyle} />}
      </span>
      {children}
    </span>
  )
}

// a few frames in turn, `ms` each, while `on`
export function useCycle<T>(frames: readonly T[], ms: number, on = true) {
  const [i, setI] = useState(0)
  useEffect(() => {
    if (!on || frames.length < 2) return
    const id = setInterval(() => setI((n) => n + 1), ms)
    return () => clearInterval(id)
  }, [frames.length, ms, on])
  return frames[i % frames.length]
}

// Tuna blinking now and then: the frame to show instead of `frame` (sitting frames only)
export function useBlink(frame: Frame, on = true) {
  const [blink, setBlink] = useState(false)
  useEffect(() => {
    if (!on) return
    let t = 0
    const next = () => {
      t = window.setTimeout(
        () => {
          setBlink(true)
          t = window.setTimeout(() => (setBlink(false), next()), 150)
        },
        2200 + Math.random() * 4000,
      )
    }
    next()
    return () => clearTimeout(t)
  }, [on])
  return blink && on && FAMILY[frame] === 'sit' ? 'blink' : frame
}

// a pixel speech bubble, its tail at the bottom left (or right)
export function Bubble({
  children,
  right = false,
  className,
}: {
  children: ReactNode
  right?: boolean
  className?: string
}) {
  return (
    <span
      className={cn(
        'pixel-bubble pointer-events-none absolute bottom-full mb-3 animate-pop px-2 py-1 font-mono text-[11px] leading-4 font-bold whitespace-nowrap text-[#1b1714]',
        right ? 'right-1' : 'left-1',
        className,
      )}
    >
      {children}
      <span className={cn('absolute -bottom-[9px] size-1.5 bg-[#1b1714]', right ? 'right-3' : 'left-3')} />
      <span className={cn('absolute -bottom-[6px] size-1.5 bg-[#e9dfd1]', right ? 'right-3' : 'left-3')} />
    </span>
  )
}

export { FRAMES, HATS, TOYS, type Frame }
