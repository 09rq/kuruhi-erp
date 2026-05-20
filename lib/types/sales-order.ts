export type SOStatus =
  | 'draft'
  | 'confirmed'
  | 'in_production'
  | 'delivered'
  | 'invoiced'
  | 'cancelled'

export const SO_STATUS_LABELS: Record<SOStatus, string> = {
  draft:         '見積中',
  confirmed:     '受注確定',
  in_production: '製造中',
  delivered:     '納品済',
  invoiced:      '請求済',
  cancelled:     'キャンセル',
}

export const SO_STATUS_COLORS: Record<SOStatus, string> = {
  draft:         'bg-gray-100 text-gray-600',
  confirmed:     'bg-blue-100 text-blue-700',
  in_production: 'bg-amber-100 text-amber-700',
  delivered:     'bg-emerald-100 text-emerald-700',
  invoiced:      'bg-purple-100 text-purple-700',
  cancelled:     'bg-red-100 text-red-600',
}

// 次のステータスへの遷移マップ
export const SO_NEXT_STATUS: Partial<Record<SOStatus, SOStatus>> = {
  draft:         'confirmed',
  confirmed:     'in_production',
  in_production: 'delivered',
  delivered:     'invoiced',
}

export interface SalesOrder {
  id: string
  order_number: string
  client_id: string | null
  order_date: string
  desired_delivery_date: string | null
  confirmed_delivery_date: string | null
  status: SOStatus
  assigned_to: string | null
  notes: string | null
  created_by: string | null
  created_at: string
  updated_at: string
  items?: SalesOrderItem[]
}

export interface SalesOrderItem {
  id: string
  order_id: string
  product_id: string | null
  product_variant_id: string | null
  quantity: number
  unit_price: number
  amount: number
  desired_delivery_date: string | null
  production_lot_id: string | null
  notes: string | null
  sort_order: number
  created_at: string
  updated_at: string
}

/** フォーム用明細行 */
export interface SOItemRow {
  _key: string
  id?: string
  product_id: string
  product_variant_id: string
  quantity: string
  unit_price: string
  desired_delivery_date: string
  notes: string
}
