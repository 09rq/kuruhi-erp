export type MaterialCategory = '革' | '生地' | '金具' | 'ファスナー' | '箱' | '刃型' | 'その他'
export type MaterialUnit = 'ds' | 'm' | 'cm' | 'mm' | '個' | '枚' | '本' | '組' | 'セット' | '式' | 'kg' | 'g' | 'その他'
export type OrderMethod = '個別' | '定期' | '定量'
export type TaxType = '外税' | '内税' | '非課税'
export type ProcurementType = 'buy' | 'supplied'

export const MATERIAL_CATEGORIES: MaterialCategory[] = ['革', '生地', '金具', 'ファスナー', '箱', '刃型', 'その他']
export const MATERIAL_UNITS: MaterialUnit[] = ['ds', 'm', 'cm', 'mm', '個', '枚', '本', '組', 'セット', '式', 'kg', 'g', 'その他']
export const ORDER_METHODS: OrderMethod[] = ['個別', '定期', '定量']
export const TAX_TYPES: TaxType[] = ['外税', '内税', '非課税']
export const TAX_RATES = [10, 8, 0]

export const CATEGORY_COLORS: Record<MaterialCategory, string> = {
  革:       'bg-amber-100 text-amber-800',
  生地:     'bg-purple-100 text-purple-800',
  金具:     'bg-slate-100 text-slate-700',
  ファスナー: 'bg-blue-100 text-blue-800',
  箱:       'bg-orange-100 text-orange-800',
  刃型:     'bg-rose-100 text-rose-700',
  その他:   'bg-gray-100 text-gray-600',
}

export interface Material {
  id: string
  code: string
  name: string
  category: MaterialCategory
  procurement_type: ProcurementType
  spec: string | null
  short_name: string | null
  color_cd: string | null
  jan_cd: string | null
  unit: MaterialUnit
  standard_price: number | null
  month_start_price: number | null
  month_end_price: number | null
  supplier_id: string | null
  order_method: OrderMethod | null
  order_lot: number | null
  tax_type: TaxType | null
  tax_rate: number | null
  sales_end_date: string | null
  stock_managed: boolean
  current_stock: number
  safety_stock: number | null
  reorder_point: number | null
  inventory_category: boolean
  storage_location: string | null
  shelf_number: string | null
  lot_management: boolean
  group_id: string | null
  price_overridden: boolean
  note: string | null
  is_active: boolean
  created_at: string
  updated_at: string
}
