export interface Employee {
  id: string
  employee_no: string
  name: string
  email: string | null
  department: string | null
  employment_type: string | null
  position: string | null
  is_active: boolean
  created_at: string
  updated_at: string
}

/** ドロップダウン選択用の軽量型 */
export type EmployeeOption = Pick<
  Employee,
  'id' | 'employee_no' | 'name' | 'department' | 'position'
>
