export type EstimateStatus = 'draft' | 'sent' | 'approved' | 'rejected'

export const ESTIMATE_STATUS_LABELS: Record<EstimateStatus, string> = {
  draft:    '下書き',
  sent:     '送付済',
  approved: '承認',
  rejected: '失注',
}

export const ESTIMATE_STATUS_COLORS: Record<EstimateStatus, string> = {
  draft:    'bg-gray-100 text-gray-600',
  sent:     'bg-blue-100 text-blue-700',
  approved: 'bg-emerald-100 text-emerald-700',
  rejected: 'bg-red-100 text-red-600',
}

export interface EstimateItem {
  id: string
  estimate_id: string
  sort_order: number
  product_id: string | null
  item_name: string
  quantity: number | null
  unit: string | null
  unit_price: number | null
  amount: number
  notes: string | null
  created_at: string
  updated_at: string
}

export interface Estimate {
  id: string
  estimate_number: string
  client_id: string | null
  client_contact: string | null
  issue_date: string
  expiry_date: string | null
  subject: string | null
  delivery_date: string | null
  total_amount: number | null
  tax_amount: number | null
  grand_total: number | null
  payment_terms: string | null
  notes: string | null
  status: EstimateStatus
  created_by: string | null
  created_at: string
  updated_at: string
  items?: EstimateItem[]
  client?: { name: string } | null
}

/** フォーム用明細行 */
export interface EstimateItemRow {
  _key: string
  id?: string
  product_id: string
  item_name: string
  quantity: string
  unit: string
  unit_price: string
  notes: string
}
