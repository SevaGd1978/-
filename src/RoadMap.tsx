import { useEffect, useRef } from 'react'
import L from 'leaflet'
import 'leaflet/dist/leaflet.css'
import type { RoadGeometry } from './roads'

export function RoadMap({ geometry }: { geometry: RoadGeometry }) {
  const host = useRef<HTMLDivElement>(null)

  useEffect(() => {
    const node = host.current
    if (!node) return
    const map = L.map(node, { attributionControl: true })
    L.tileLayer('https://tile.openstreetmap.org/{z}/{x}/{y}.png', {
      maxZoom: 18,
      attribution: '© OpenStreetMap',
    }).addTo(map)
    const line = L.polyline(
      geometry.coordinates.map(([lon, lat]) => [lat, lon] as [number, number]),
      { color: '#c24e1d', weight: 4 },
    ).addTo(map)
    const start = geometry.coordinates[0]
    const end = geometry.coordinates[geometry.coordinates.length - 1]
    if (start) {
      L.circleMarker([start[1], start[0]], {
        radius: 5,
        color: '#c24e1d',
        fillColor: '#f8efd8',
        fillOpacity: 1,
        weight: 2,
      }).addTo(map)
    }
    if (end) {
      L.circleMarker([end[1], end[0]], {
        radius: 5,
        color: '#8c3412',
        fillColor: '#c24e1d',
        fillOpacity: 1,
        weight: 2,
      }).addTo(map)
    }
    if (line.getBounds().isValid()) map.fitBounds(line.getBounds(), { padding: [16, 16] })
    const timer = window.setTimeout(() => map.invalidateSize(), 60)
    return () => {
      window.clearTimeout(timer)
      map.remove()
    }
  }, [geometry])

  return <div ref={host} className="road-map" role="img" aria-label="Карта автодороги" />
}
