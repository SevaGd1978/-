import { useEffect, useMemo, useState } from 'react'
import { legKey, type RoadLeg } from './roads'

export function useRoadRoutes(pairs: { from: string; to: string }[]) {
  const signature = useMemo(() => {
    const unique = new Set(pairs.map((pair) => legKey(pair.from, pair.to)))
    return [...unique].sort().join('|')
  }, [pairs])
  const [routes, setRoutes] = useState<Record<string, RoadLeg>>({})
  const [ready, setReady] = useState(false)

  useEffect(() => {
    if (!signature) {
      setRoutes({})
      setReady(true)
      return
    }
    const list = signature.split('|').map((key) => {
      const [from, to] = key.split('\n')
      return { from, to }
    })
    let stop = false
    setReady(false)
    void fetch('/api/routes', {
      method: 'POST',
      headers: { 'content-type': 'application/json' },
      body: JSON.stringify({ pairs: list }),
    })
      .then(async (response) => {
        if (!response.ok) return null
        return (await response.json()) as { routes?: RoadLeg[] }
      })
      .then((body) => {
        if (stop) return
        const next: Record<string, RoadLeg> = {}
        for (const leg of body?.routes ?? []) next[legKey(leg.from, leg.to)] = leg
        setRoutes(next)
        setReady(true)
      })
      .catch(() => {
        if (!stop) setReady(true)
      })
    return () => {
      stop = true
    }
  }, [signature])

  return { routes, ready }
}
