import { useCallback, useEffect, useRef, useState } from 'react'

// PCI DSS Requirement 8.2.8 (the standard financial-industry benchmark,
// mandatory as of PCI DSS v4.0): sessions handling sensitive account
// data must require re-authentication after no more than 15 minutes of
// inactivity. We warn 60 seconds before that, mirroring how most banking
// apps give a last chance to stay signed in rather than logging out with
// no notice.
const IDLE_TIMEOUT_MS = 15 * 60 * 1000
const WARNING_BEFORE_MS = 60 * 1000

const ACTIVITY_EVENTS = ['mousemove', 'mousedown', 'keydown', 'touchstart', 'scroll'] as const

export function useIdleTimeout(onTimeout: () => void) {
  const [warning, setWarning] = useState(false)
  const [secondsLeft, setSecondsLeft] = useState(Math.floor(WARNING_BEFORE_MS / 1000))
  const warnTimer = useRef<ReturnType<typeof setTimeout> | undefined>(undefined)
  const logoutTimer = useRef<ReturnType<typeof setTimeout> | undefined>(undefined)
  const countdownInterval = useRef<ReturnType<typeof setInterval> | undefined>(undefined)

  const clearTimers = useCallback(() => {
    clearTimeout(warnTimer.current)
    clearTimeout(logoutTimer.current)
    clearInterval(countdownInterval.current)
  }, [])

  const reset = useCallback(() => {
    clearTimers()
    setWarning(false)
    setSecondsLeft(Math.floor(WARNING_BEFORE_MS / 1000))

    warnTimer.current = setTimeout(() => {
      setWarning(true)
      let remaining = Math.floor(WARNING_BEFORE_MS / 1000)
      countdownInterval.current = setInterval(() => {
        remaining -= 1
        setSecondsLeft(remaining)
        if (remaining <= 0) clearInterval(countdownInterval.current)
      }, 1000)
    }, IDLE_TIMEOUT_MS - WARNING_BEFORE_MS)

    logoutTimer.current = setTimeout(() => {
      clearTimers()
      onTimeout()
    }, IDLE_TIMEOUT_MS)
  }, [clearTimers, onTimeout])

  useEffect(() => {
    reset()
    const handleActivity = () => {
      // While the warning is showing, activity alone shouldn't silently
      // dismiss it — the person should consciously choose "Stay signed
      // in," same as most banking apps. Typing/clicking on the warning
      // dialog itself is handled by its own button, not this listener.
      if (!warning) reset()
    }
    ACTIVITY_EVENTS.forEach((evt) => window.addEventListener(evt, handleActivity))
    return () => {
      ACTIVITY_EVENTS.forEach((evt) => window.removeEventListener(evt, handleActivity))
      clearTimers()
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [])

  return { warning, secondsLeft, staySignedIn: reset }
}
