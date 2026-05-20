export type SOStatus = 'draft' | 'confirmed' | 'in_production' | 'delivered' | 'invoiced' | 'cancelled'

export const SO_STATUS_LABELS: Record<SOStatus, string> = {
  draft: '下書き',
  confirmed: '受注確定',
  in_production: '製造中',
  delivered: '納品済み',
  invoiced: '請求済み',
  cancelled: 'キャンセル',
}

export const SO_STATUS_COLORS: Record<SOStatus, string> = {
  draft: 'bg-gray-100 text-gray-700',
  confirmed: 'bg-blue-100 text-blue-700',
  in_production: 'bg-yellow-100 text-yellow-700',
  delivered: 'bg-green-100 text-green-700',
  invoiced: 'bg-purple-100 text-purple-700',
  cancelled: 'bg-red-100 text-red-700',
}

export const SO_NEXT_STATUS: Partial<Record<SOStatus, SOStatus>> = {
  draft: 'confirmed',
  confirmed: 'in_production',
  in_production: 'delivered',
}

export interface SOItemRow {
  _key?: string
  id?: string
  product_id?: string | null
  product_variant_id?: string | null
  product_name?: string
  quantity?: number | string
  unit_price?: number | string
  desired_delivery_date?: string | null
  notes?: string | null
  amount?: number
  sort_order?: number
}

export interface SalesOrderItem {
  id: string
  product_name: string
  quantity: number
  unit_price: number
  amount: number
  note: string | null
  notes?: string | null
  desired_delivery_date?: string | null
  confirmed_delivery_date?: string | null
  assigned_to?: string | null
}

export interface SalesOrder {
  id: string
  order_no: string
  client_id: string
  status: SOStatus
  order_date: string
  delivery_date: string | null
  total_amount: number
  note: string | null
  notes?: string | null
  desired_delivery_date?: string | null
  confirmed_delivery_date?: string | null
  assigned_to?: string | null
  created_at: string
  updated_at: string
  items?: SOItemRow[]
}
