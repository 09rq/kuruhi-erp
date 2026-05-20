export type EstimateStatus = 'draft' | 'sent' | 'approved' | 'rejected' | 'expired'

export const ESTIMATE_STATUS_LABELS: Record<EstimateStatus, string> = {
  draft: '下書き',
  sent: '送付済み',
  approved: '承認済み',
  rejected: '却下',
  expired: '期限切れ',
}

export const ESTIMATE_STATUS_COLORS: Record<EstimateStatus, string> = {
  draft: 'bg-gray-100 text-gray-700',
  sent: 'bg-blue-100 text-blue-700',
  approved: 'bg-green-100 text-green-700',
  rejected: 'bg-red-100 text-red-700',
  expired: 'bg-yellow-100 text-yellow-700',
}

export interface EstimateItemRow {
  _key?: string
  id?: string
  estimate_id?: string
  product_id?: string | null
  item_name?: string
  quantity?: number | string
  unit?: string | null
  unit_price?: number | string
  notes?: string | null
  material_id?: string | null
  description?: string
  amount?: number
  sort_order?: number
}

export interface Estimate {
  id: string
  estimate_no?: string
  estimate_number?: string
  client_id: string
  client_contact?: string | null
  status: EstimateStatus
  issue_date: string
  expiry_date?: string | null
  subject?: string | null
  delivery_date?: string | null
  total_amount: number
  tax_amount?: number | null
  grand_total?: number | null
  payment_terms?: string | null
  notes?: string | null
  created_at: string
  updated_at: string
  items?: EstimateItemRow[]
}
