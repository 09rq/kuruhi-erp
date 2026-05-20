// 材料区分は材料マスタと統一（MATERIAL_CATEGORIES を正とする）
export { MATERIAL_CATEGORIES as BOM_CATEGORIES } from '@/lib/types/material'
export type BomCategory = import('@/lib/types/material').MaterialCategory

export interface Bom {
  id: string
  product_id: string
  product_variant_id: string | null
  version: number
  is_active: boolean
  notes: string | null
  created_by: string | null
  created_at: string
  updated_at: string
}

export interface BomItem {
  id: string
  bom_id: string
  material_id: string
  category: string | null
  quantity: number
  unit: string | null
  yield_rate: number
  width_cm: number | null
  net_quantity: number
  unit_price: number
  amount: number
  sort_order: number
  notes: string | null
  created_at: string
  updated_at: string
}
