export type LotStatus = 'planned' | 'in_production' | 'in_progress' | 'completed' | 'shipped' | 'cancelled'

export const LOT_STATUS_LABELS: Record<LotStatus, string> = {
  planned: '予定',
  in_production: '製造中',
  in_progress: '進行中',
  completed: '完成',
  shipped: '出荷済み',
  cancelled: 'キャンセル',
}

export const LOT_STATUS_COLORS: Record<LotStatus, string> = {
  planned: 'bg-gray-100 text-gray-700',
  in_production: 'bg-blue-100 text-blue-700',
  in_progress: 'bg-yellow-100 text-yellow-700',
  completed: 'bg-green-100 text-green-700',
  shipped: 'bg-gray-100 text-gray-700',
  cancelled: 'bg-red-100 text-red-700',
}

export type MaterialTransactionType = 'purchase_in' | 'process_return' | 'inventory_adjust' | 'other_in' | 'production_out' | 'other_out' | 'use_out' | 'return_in' | 'adjust' | 'inventory'

export const MATERIAL_TRANSACTION_LABELS: Record<MaterialTransactionType, string> = {
  purchase_in: '仕入入庫',
  process_return: '加工返品',
  inventory_adjust: '棚卸調整',
  other_in: 'その他入庫',
  production_out: '製造出庫',
  other_out: 'その他出庫',
  use_out: '製造出庫',
  return_in: '返品入庫',
  adjust: '調整',
  inventory: '棚卸',
}
