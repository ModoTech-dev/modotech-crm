// A quiet circuit-pattern texture behind the message thread — same
// visual language as the login page's CircuitBackground, but tuned way
// down: no animation, very low contrast. This is a working area people
// read and type in for extended periods, so the background needs to
// stay felt rather than seen — texture, not decoration competing for
// attention against actual message content.
export function ChatBackground() {
  const traces = [
    'M -40 100 H 220 V 30 H 460',
    'M -40 220 H 140 V 300 H 400 V 180 H 680',
    'M 820 50 H 580 V 160 H 340',
    'M 860 380 H 640 V 280 H 380 V 420',
    'M -40 440 H 200 V 520 H 560',
    'M 900 500 H 700 V 580 H 460',
  ]
  const nodes = [
    { cx: 220, cy: 100 }, { cx: 220, cy: 30 }, { cx: 460, cy: 30 },
    { cx: 140, cy: 220 }, { cx: 140, cy: 300 }, { cx: 400, cy: 300 }, { cx: 400, cy: 180 }, { cx: 680, cy: 180 },
    { cx: 580, cy: 50 }, { cx: 580, cy: 160 }, { cx: 340, cy: 160 },
    { cx: 640, cy: 380 }, { cx: 640, cy: 280 }, { cx: 380, cy: 280 }, { cx: 380, cy: 420 },
    { cx: 200, cy: 440 }, { cx: 200, cy: 520 }, { cx: 560, cy: 520 },
    { cx: 700, cy: 500 }, { cx: 700, cy: 580 }, { cx: 460, cy: 580 },
  ]

  return (
    <svg
      className="pointer-events-none absolute inset-0 h-full w-full"
      viewBox="0 0 900 620"
      preserveAspectRatio="xMidYMid slice"
      aria-hidden="true"
    >
      {traces.map((d, i) => (
        <path key={i} d={d} fill="none" stroke="var(--color-ink-200)" strokeWidth="1.5" opacity="0.6" />
      ))}
      {nodes.map((n, i) => (
        <circle key={i} cx={n.cx} cy={n.cy} r="3" fill="var(--color-ink-50)" stroke="var(--color-ink-200)" strokeWidth="1.5" />
      ))}
    </svg>
  )
}
