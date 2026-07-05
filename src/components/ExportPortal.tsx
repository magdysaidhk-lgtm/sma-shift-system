import { useEffect, useState, type ReactNode } from 'react'
import { createPortal } from 'react-dom'

/**
 * Renders children into the top-level #exportView div declared in Layout.tsx,
 * which lives OUTSIDE #appView. This matters because @media print sets
 * #appView{display:none} — if the export markup were nested inside #appView
 * (as a plain child div), it would never be visible on print no matter what
 * display rule targeted it directly, since a hidden ancestor hides everything
 * under it regardless of the descendant's own display value.
 */
export default function ExportPortal({ children }: { children: ReactNode }) {
  const [target, setTarget] = useState<HTMLElement | null>(null)

  useEffect(() => {
    setTarget(document.getElementById('exportView'))
  }, [])

  if (!target) return null
  return createPortal(children, target)
}
