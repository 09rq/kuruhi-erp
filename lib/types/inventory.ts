export type MaterialTransactionType =
  | 'purchase_in'
  | 'production_out'
  | 'process_return'
  | 'inventory_adjust'
  | 'other_in'
  | 'other_out'

export const MATERIAL_TRANSACTION_LABELS: Record<MaterialTransactionType, string> = {
  purchase_in:      '仕入入庫',
  production_out:   '製造払出',
  process_return:   '加工返却',
  inventory_adjust: '棚卸調整',
  other_in:         'その他入庫',
  other_out:        'その他出庫',
}

export type LotStatus = 'planned' | 'in_progress' | 'completed' | 'cancelled'

export const LOT_STATUS_LABELS: Record<LotStatus, string> = {
  planned:     '予定',
  in_progress: '製造中',
  completed:   '完了',
  cancelled:   'キャンセル',
}

export const LOT_STATUS_COLORS: Record<LotStatus, string> = {
  planned:     'bg-gray-100 text-gray-600',
  in_progress: 'bg-blue-100 text-blue-700',
  completed:   'bg-green-100 text-green-700',
  cancelled:   'bg-red-100 text-red-600',
}

export type ProductTransactionType =
  | 'production_in'
  | 'sales_out'
  | 'return_in'
  | 'inventory_adjust'

export const PRODUCT_TRANSACTION_LABELS: Record<ProductTransactionType, string> = {
  production_in:    '製造入庫',
  sales_out:        '販売出庫',
  return_in:        '返品入庫',
  inventory_adjust: '棚卸調整',
}

export interface MaterialStockTransaction {
  id: string
  material_id: string
  transaction_type: MaterialTransactionType
  quantity: number
  unit_price: number | null
  amount: number | null
  reference_type: string | null
  reference_id: string | null
  note: string | null
  transaction_date: string
  created_by: string | null
  created_at: string
  updated_at: string
}

export interface ProductionLot {
  id: string
  lot_number: string
  product_id: string
  product_variant_id: string | null
  planned_quantity: number
  completed_quantity: number
  status: LotStatus
  started_at: string | null
  completed_at: string | null
  notes: string | null
  created_by: string | null
  created_at: string
  updated_at: string
}

export interface ProductionLotProcess {
  id: string
  lot_id: string
  sort_order: number
  process_name: string
  vendor_id: string | null
  planned_quantity: number
  unit_price: number
  amount: number
  purchase_status: 'unpaid' | 'paid'
  purchase_date: string | null
  purchase_order_id: string | null
  wip_value: number
  notes: string | null
  created_at: string
  updated_at: string
}

export interface ProductStockTransaction {
  id: string
  product_id: string
  product_variant_id: string | null
  transaction_type: ProductTransactionType
  quantity: number
  unit_cost: number | null
  amount: number | null
  reference_type: string | null
  reference_id: string | null
  note: string | null
  transaction_date: string
  created_by: string | null
  created_at: string
  updated_at: string
}
