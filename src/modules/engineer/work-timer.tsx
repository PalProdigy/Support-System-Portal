'use client'

import { useState, useEffect } from 'react'
import { Button } from '@/components/ui/button'
import { Clock, Pause, Play, RotateCcw } from 'lucide-react'
import { cn } from '@/lib/utils'

function pad(n: number) { return String(n).padStart(2, '0') }

function formatTime(s: number) {
  const h = Math.floor(s / 3600)
  const m = Math.floor((s % 3600) / 60)
  const sec = s % 60
  return h > 0 ? `${h}:${pad(m)}:${pad(sec)}` : `${pad(m)}:${pad(sec)}`
}

export function WorkTimer() {
  const [elapsed, setElapsed] = useState(0)
  const [running, setRunning] = useState(false)

  // Single interval — cleaned up on unmount or when running becomes false
  useEffect(() => {
    if (!running) return
    const id = setInterval(() => setElapsed((e) => e + 1), 1000)
    return () => clearInterval(id)
  }, [running])

  return (
    <div className="flex items-center gap-2 bg-muted/40 rounded-lg px-3 py-2 border">
      <Clock className={cn('h-4 w-4 shrink-0', running ? 'text-primary animate-pulse' : 'text-muted-foreground')} />
      <span className="font-mono text-sm font-semibold text-foreground tabular-nums w-14">{formatTime(elapsed)}</span>
      <Button
        variant="ghost"
        size="icon"
        className="h-6 w-6"
        title={running ? 'Pause timer' : 'Start timer'}
        onClick={() => setRunning((r) => !r)}
      >
        {running ? <Pause className="h-3 w-3" /> : <Play className="h-3 w-3" />}
      </Button>
      <Button
        variant="ghost"
        size="icon"
        className="h-6 w-6 text-muted-foreground"
        title="Reset timer"
        onClick={() => { setRunning(false); setElapsed(0) }}
      >
        <RotateCcw className="h-3 w-3" />
      </Button>
    </div>
  )
}