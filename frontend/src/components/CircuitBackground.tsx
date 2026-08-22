// Ambient animated background for the login screen — traces "signal"
// pulses along circuit-style traces, echoing the logo's own circuit-node
// motif. Purely decorative: sits behind the login card (z-0), the card
// itself stays fully solid so legibility is never in question.
export function CircuitBackground() {
  // Each trace is an L/Z-shaped wire; the "flow" path (same geometry,
  // dashed and animated) rides on top to create a traveling light effect.
  const traces = [
    { d: 'M -40 120 H 260 V 40 H 520', delay: '0s', color: 'var(--color-signal-400)' },
    { d: 'M -40 260 H 160 V 340 H 460 V 220 H 760', delay: '1.4s', color: 'var(--color-signal-400)' },
    { d: 'M 900 60 H 640 V 180 H 380', delay: '2.6s', color: 'var(--color-signal-500)' },
    { d: 'M 940 420 H 700 V 320 H 420 V 460', delay: '0.6s', color: 'var(--color-red-500)' },
    { d: 'M -40 480 H 220 V 560 H 600 V 500', delay: '3.4s', color: 'var(--color-signal-400)' },
    { d: 'M 980 560 H 760 V 640 H 500', delay: '1.9s', color: 'var(--color-signal-500)' },
  ]
  const nodes = [
    { cx: 260, cy: 120 }, { cx: 260, cy: 40 }, { cx: 520, cy: 40 },
    { cx: 160, cy: 260 }, { cx: 160, cy: 340 }, { cx: 460, cy: 340 }, { cx: 460, cy: 220 }, { cx: 760, cy: 220 },
    { cx: 640, cy: 60 }, { cx: 640, cy: 180 }, { cx: 380, cy: 180 },
    { cx: 700, cy: 420 }, { cx: 700, cy: 320 }, { cx: 420, cy: 320 }, { cx: 420, cy: 460 },
    { cx: 220, cy: 480 }, { cx: 220, cy: 560 }, { cx: 600, cy: 560 }, { cx: 600, cy: 500 },
    { cx: 760, cy: 560 }, { cx: 760, cy: 640 }, { cx: 500, cy: 640 },
  ]

  return (
    <svg
      className="pointer-events-none absolute inset-0 h-full w-full"
      viewBox="0 0 1000 700"
      preserveAspectRatio="xMidYMid slice"
      aria-hidden="true"
    >
      {traces.map((t, i) => (
        <g key={i}>
          <path d={t.d} fill="none" stroke="var(--color-ink-700)" strokeWidth="1.5" opacity="0.35" />
          <path
            d={t.d}
            fill="none"
            stroke={t.color}
            strokeWidth="2"
            strokeLinecap="round"
            strokeDasharray="14 240"
            className="circuit-flow"
            style={{ animationDelay: t.delay }}
          />
        </g>
      ))}
      {nodes.map((n, i) => (
        <circle
          key={i}
          cx={n.cx}
          cy={n.cy}
          r="4"
          fill="var(--color-ink-900)"
          stroke="var(--color-signal-400)"
          strokeWidth="1.5"
          className="circuit-node"
          style={{ animationDelay: `${(i % 7) * 0.4}s` }}
        />
      ))}
    </svg>
  )
}
