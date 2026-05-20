export type POStatus =
  | 'draft'
  | 'ordered'
  | 'awaiting_delivery'
  | 'delivered'
  | 'cancelled'

export const PO_STATUS_LABELS: Record<POStatus, string> = {
  draft:              '下書き',
  ordered:            '発注済',
  awaiting_delivery:  '納品待ち',
  delivered:          '納品済',
  cancelled:          'キャンセル',
}

export const PO_STATUS_COLORS: Record<POStatus, string> = {
  draft:              'bg-gray-100 text-gray-600',
  ordered:            'bg-blue-100 text-blue-700',
  awaiting_delivery:  'bg-amber-100 text-amber-700',
  delivered:          'bg-emerald-100 text-emerald-700',
  cancelled:          'bg-red-100 text-red-600',
}

export interface PurchaseOrderItem {
  id: string
  purchase_order_id: string
  sort_order: number
  material_id: string | null
  item_name: string
  model_name: string | null
  color: string | null
  quantity: number
  unit: string | null
  unit_price: number
  amount: number
  delivery_date: string | null
}

export interface PurchaseOrder {
  id: string
  po_number: string
  status: POStatus
  order_date: string
  desired_delivery_date: string | null
  supplier_id: string | null
  supplier_name: string
  supplier_phone: string | null
  supplier_fax: string | null
  supplier_contact: string | null
  assigned_employee_id: string | null
  subtotal: number
  note: string | null
  created_at: string
  updated_at: string
  items?: PurchaseOrderItem[]
}

/** フォーム用明細行（id は新規行なら undefined） */
export interface POItemRow {
  _key: string            // React key用（UUID or 一時キー）
  id?: string
  material_id: string
  item_name: string
  model_name: string
  color: string
  quantity: string
  unit: string
  unit_price: string
  delivery_date: string
}
