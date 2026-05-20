export type CustomerType =
  | 'customer'           // 販売先
  | 'vendor_processing'  // 仕入先（外注加工）
  | 'vendor_material'    // 仕入先（材料仕入）

export const CUSTOMER_TYPE_LABELS: Record<CustomerType, string> = {
  customer: '販売先',
  vendor_processing: '仕入先（外注加工）',
  vendor_material: '仕入先（材料仕入）',
}

export const CUSTOMER_TYPE_COLORS: Record<CustomerType, string> = {
  customer: 'bg-blue-100 text-blue-800',
  vendor_processing: 'bg-orange-100 text-orange-800',
  vendor_material: 'bg-green-100 text-green-800',
}

export interface Customer {
  id: string
  code: string
  type: CustomerType
  name: string
  name_kana: string | null
  short_name: string | null
  postal_code: string | null
  address: string | null
  phone: string | null
  mobile: string | null
  fax: string | null
  email: string | null
  sub_category: string | null
  contact_person: string | null
  payment_terms: string | null
  bank_name: string | null
  bank_branch: string | null
  bank_account_type: string | null
  bank_account_no: string | null
  bank_account_name: string | null
  invoice_number: string | null
  assigned_employee_id: string | null
  note: string | null
  is_active: boolean
  created_at: string
  updated_at: string
}

export type CustomerFormData = Omit<Customer, 'id' | 'created_at' | 'updated_at'>
