import Link from 'next/link'
import { notFound } from 'next/navigation'
import { createClient } from '@/lib/supabase/server'
import SalesOrderForm from '../../SalesOrderForm'

export default async function EditSalesOrderPage({
  params,
}: {
  params: Promise<{ id: string }>
}) {
  const { id } = await params
  const supabase = await createClient()

  const [
    { data: order, error },
    { data: clients },
    { data: products },
    { data: variants },
    { data: employees },
  ] = await Promise.all([
    supabase
      .from('sales_orders')
      .select('*, items:sales_order_items(*)')
      .eq('id', id)
      .order('sort_order', { referencedTable: 'sales_order_items' })
      .single(),
    supabase.from('customers').select('id, name')
      .eq('type', 'customer').eq('is_active', true).order('name'),
    supabase.from('products').select('id, product_no, name, selling_price, cost_confirmed, client_id')
      .eq('status', 'active').order('product_no'),
    supabase.from('product_variants').select('id, product_id, color_name, size_label'),
    supabase.from('employees').select('id, name, department')
      .eq('is_active', true).order('name'),
  ])

  if (error || !order) notFound()

  return (
    <div className="p-8">
      <div className="mb-6">
        <div className="flex items-center gap-2 text-sm text-gray-500 mb-2">
          <Link href="/sales/orders" className="hover:text-gray-700">受注管理</Link>
          <span>/</span>
          <Link href={`/sales/orders/${id}`} className="hover:text-gray-700">{order.order_number}</Link>
          <span>/</span>
          <span className="text-gray-900">編集</span>
        </div>
        <h1 className="text-2xl font-bold text-gray-900">
          {order.order_number}
          <span className="ml-3 text-base font-normal text-gray-400">編集</span>
        </h1>
      </div>
      <SalesOrderForm
        order={order}
        clients={clients ?? []}
        products={products ?? []}
        variants={variants ?? []}
        employees={employees ?? []}
      />
    </div>
  )
}
