export type ProductStatus = 'active' | 'sample' | 'discontinued'
export type VariantStatus = 'active' | 'discontinued'
export type CostMode = 'estimate' | 'standard'
export type CostType = 'material' | 'outsource' | 'labor'

export const PRODUCT_STATUS_LABELS: Record<ProductStatus, string> = {
  active:       '有効',
  sample:       'サンプル',
  discontinued: '廃番',
}

export const PRODUCT_STATUS_COLORS: Record<ProductStatus, string> = {
  active:       'bg-emerald-100 text-emerald-700',
  sample:       'bg-blue-100 text-blue-700',
  discontinued: 'bg-gray-100 text-gray-500',
}

export const MATERIAL_COST_CATEGORIES = ['革', '生地', '金具', 'ファスナー', '箱', 'その他'] as const

export const OUTSOURCE_PROCESSES = [
  '革裁断', '革漉き', '生地裁断', 'コバ塗り', '縫製', '内職', '判子', '検品', 'その他',
] as const

export const LABOR_PROCESSES = [
  { name: '事前検品', department: 'quality' },
  { name: '本検品', department: 'quality' },
  { name: '部材確認', department: 'quality' },
  { name: '裁断', department: 'production' },
  { name: 'その他', department: null },
] as const

export const LABOR_RATE_TYPES = [
  { value: 'fixed', label: '個あたり固定' },
  { value: 'hourly', label: '時給×時間' },
] as const

export interface ProductCategory {
  id: string
  name: string
  sort_order: number
  is_active: boolean
}

export interface ProductVariant {
  id: string
  product_id: string
  sort_order: number
  color_name: string | null
  color_hex: string | null
  material: string | null
  size_label: string | null
  status: VariantStatus
  created_at: string
  updated_at: string
}

export interface ProductCostItem {
  id: string
  product_id: string
  cost_type: CostType
  cost_mode: CostMode
  category: string | null
  supplier: string | null
  name: string | null
  material_id: string | null
  quantity: number
  unit_price: number
  yield_rate: number | null
  width_cm: number | null
  amount: number
  notes: string | null
  sort_order: number
  rate_type: string | null
  hourly_rate: number | null
  hours: number | null
  created_at: string
  updated_at: string
}

export interface Product {
  id: string
  product_no: string
  name: string
  category_id: string | null
  client_id: string | null
  client_product_no: string | null
  width_mm: number | null
  height_mm: number | null
  depth_mm: number | null
  standard_material_cost: number | null
  standard_processing_cost: number | null
  standard_cost: number
  selling_price: number | null
  status: ProductStatus
  cost_mode: CostMode
  defect_rate: number | null
  cost_confirmed: boolean
  brand_name: string | null
  series_name: string | null
  shipping_cost: number | null
  misc_cost: number | null
  note: string | null
  created_at: string
  updated_at: string
}
