import Link from 'next/link'
import { createClient } from '@/lib/supabase/server'
import SalesOrderForm from '../SalesOrderForm'

export default async function NewSalesOrderPage() {
  const supabase = await createClient()

  const [
    { data: clients },
    { data: products },
    { data: variants },
    { data: employees },
  ] = await Promise.all([
    supabase.from('customers').select('id, name')
      .eq('type', 'customer').eq('is_active', true).order('name'),
    supabase.from('products').select('id, product_no, name, selling_price, cost_confirmed, client_id')
      .eq('status', 'active').order('product_no'),
    supabase.from('product_variants').select('id, product_id, color_name, size_label'),
    supabase.from('employees').select('id, name, department')
      .eq('is_active', true).order('name'),
  ])

  return (
    <div className="p-8">
      <div className="mb-6">
        <div className="flex items-center gap-2 text-sm text-gray-500 mb-2">
          <Link href="/sales/orders" className="hover:text-gray-700">受注管理</Link>
          <span>/</span>
          <span className="text-gray-900">新規受注</span>
        </div>
        <h1 className="text-2xl font-bold text-gray-900">受注登録</h1>
      </div>
      <SalesOrderForm
        clients={clients ?? []}
        products={products ?? []}
        variants={variants ?? []}
        employees={employees ?? []}
      />
    </div>
  )
}
