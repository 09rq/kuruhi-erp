import type { POStatus } from '@/lib/types/purchase-order'
import { PO_STATUS_LABELS, PO_STATUS_COLORS } from '@/lib/types/purchase-order'

export default function StatusBadge({ status }: { status: POStatus }) {
  return (
    <span className={`inline-block px-2 py-0.5 rounded-full text-xs font-medium ${PO_STATUS_COLORS[status]}`}>
      {PO_STATUS_LABELS[status]}
    </span>
  )
}
