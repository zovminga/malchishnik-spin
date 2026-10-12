import { useId, useRef, useState } from 'react'
import { DESTINATIONS, type Destination } from '../destinations'

const SPIN_MS = 5200
const MIN_TURNS = 6

type RouletteProps = {
  onResult: (destination: Destination) => void
  spinning: boolean
  setSpinning: (value: boolean) => void
}

function polarToCartesian(cx: number, cy: number, r: number, angleDeg: number) {
  const rad = ((angleDeg - 90) * Math.PI) / 180
  return {
    x: cx + r * Math.cos(rad),
    y: cy + r * Math.sin(rad),
  }
}

function describeSlice(
  cx: number,
  cy: number,
  r: number,
  startAngle: number,
  endAngle: number,
) {
  const start = polarToCartesian(cx, cy, r, endAngle)
  const end = polarToCartesian(cx, cy, r, startAngle)
  const largeArc = endAngle - startAngle <= 180 ? 0 : 1
  return [
    `M ${cx} ${cy}`,
    `L ${start.x} ${start.y}`,
    `A ${r} ${r} 0 ${largeArc} 0 ${end.x} ${end.y}`,
    'Z',
  ].join(' ')
}

export function Roulette({ onResult, spinning, setSpinning }: RouletteProps) {
  const filterId = useId()
  const [rotation, setRotation] = useState(0)
  const [glow, setGlow] = useState(false)
  const lockRef = useRef(false)
  const slice = 360 / DESTINATIONS.length

  const spin = () => {
    if (lockRef.current || spinning) return
    lockRef.current = true
    setSpinning(true)
    setGlow(false)

    const index = Math.floor(Math.random() * DESTINATIONS.length)
    // Pointer sits at top (0°). Segment centers are at index * slice + slice/2.
    // Wheel rotates clockwise via positive CSS rotate, so we subtract.
    const segmentCenter = index * slice + slice / 2
    const jitter = (Math.random() - 0.5) * (slice * 0.55)
    const targetMod = (360 - segmentCenter + jitter + 360) % 360
    const currentMod = ((rotation % 360) + 360) % 360
    const delta =
      ((targetMod - currentMod + 360) % 360) + MIN_TURNS * 360 + Math.floor(Math.random() * 360)

    const next = rotation + delta
    setRotation(next)

    window.setTimeout(() => {
      setSpinning(false)
      setGlow(true)
      onResult(DESTINATIONS[index])
      lockRef.current = false
    }, SPIN_MS)
  }

  return (
    <div className="roulette">
      <div className={`wheel-stage${glow ? ' wheel-stage--win' : ''}`}>
        <div className="pointer" aria-hidden="true" />
        <div
          className="wheel"
          style={{
            transform: `rotate(${rotation}deg)`,
            transition: spinning
              ? `transform ${SPIN_MS}ms cubic-bezier(0.12, 0.75, 0.08, 1)`
              : 'none',
          }}
        >
          <svg viewBox="0 0 400 400" role="img" aria-label="Рулетка мест">
            <defs>
              <filter id={filterId} x="-20%" y="-20%" width="140%" height="140%">
                <feDropShadow
                  dx="0"
                  dy="2"
                  stdDeviation="2"
                  floodColor="#000"
                  floodOpacity="0.45"
                />
              </filter>
            </defs>
            <circle cx="200" cy="200" r="198" fill="#0a1f14" />
            {DESTINATIONS.map((dest, i) => {
              const start = i * slice
              const end = start + slice
              const mid = start + slice / 2
              const labelPos = polarToCartesian(200, 200, 118, mid)
              return (
                <g key={dest.id}>
                  <path
                    d={describeSlice(200, 200, 190, start, end)}
                    fill={dest.color}
                    stroke="#0a1f14"
                    strokeWidth="2"
                  />
                  <text
                    x={labelPos.x}
                    y={labelPos.y}
                    fill={dest.text}
                    fontSize="18"
                    fontFamily="Bungee, sans-serif"
                    textAnchor="middle"
                    dominantBaseline="middle"
                    transform={`rotate(${mid}, ${labelPos.x}, ${labelPos.y})`}
                    filter={`url(#${filterId})`}
                  >
                    {dest.label}
                  </text>
                </g>
              )
            })}
            <circle
              cx="200"
              cy="200"
              r="190"
              fill="none"
              stroke="#f5c542"
              strokeWidth="8"
            />
            <circle
              cx="200"
              cy="200"
              r="178"
              fill="none"
              stroke="#fff4c2"
              strokeWidth="1.5"
              opacity="0.55"
            />
            {Array.from({ length: 24 }).map((_, i) => {
              const a = (i / 24) * 360
              const outer = polarToCartesian(200, 200, 194, a)
              return (
                <circle
                  key={i}
                  cx={outer.x}
                  cy={outer.y}
                  r="3.5"
                  fill={i % 2 === 0 ? '#f5c542' : '#fff8e7'}
                />
              )
            })}
            <circle cx="200" cy="200" r="42" fill="#0a1f14" stroke="#f5c542" strokeWidth="6" />
            <circle cx="200" cy="200" r="28" fill="#f5c542" />
            <text
              x="200"
              y="206"
              textAnchor="middle"
              fontFamily="Bungee, sans-serif"
              fontSize="11"
              fill="#1a0d00"
            >
              SPIN
            </text>
          </svg>
        </div>
      </div>

      <button
        type="button"
        className="spin-btn"
        onClick={spin}
        disabled={spinning}
        aria-busy={spinning}
      >
        {spinning ? 'КРУТИТСЯ…' : 'КРУТИТЬ РУЛЕТКУ'}
      </button>
    </div>
  )
}
