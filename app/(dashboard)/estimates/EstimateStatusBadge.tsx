import type { EstimateStatus } from '@/lib/types/estimate'
import { ESTIMATE_STATUS_LABELS, ESTIMATE_STATUS_COLORS } from '@/lib/types/estimate'

export default function EstimateStatusBadge({ status }: { status: EstimateStatus }) {
  return (
    <span className={`inline-block px-2 py-0.5 rounded-full text-xs font-medium ${ESTIMATE_STATUS_COLORS[status]}`}>
      {ESTIMATE_STATUS_LABELS[status]}
    </span>
  )
}
