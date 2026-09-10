import type { MaterialCategory, MaterialUnit } from './material'

export interface MaterialGroup {
  id: string
  name: string
  category: MaterialCategory | null
  unit: MaterialUnit | null
  standard_price: number | null
  supplier_id: string | null
  note: string | null
  is_active: boolean
  created_at: string
  updated_at: string
}
