import Link from 'next/link'
import { notFound } from 'next/navigation'
import { createClient } from '@/lib/supabase/server'
import PurchaseOrderForm from '../../PurchaseOrderForm'

export default async function PurchaseOrderEditPage({
  params,
}: {
  params: Promise<{ id: string }>
}) {
  const { id } = await params
  const supabase = await createClient()

  const [{ data: po, error }, { data: suppliers }, { data: employees }, { data: materials }] =
    await Promise.all([
      supabase.from('purchase_orders').select('*, items:purchase_order_items(*)')
        .eq('id', id).order('sort_order', { referencedTable: 'purchase_order_items' }).single(),
      supabase.from('customers').select('id,name,phone,fax,contact_person')
        .in('type', ['vendor_processing', 'vendor_material']).eq('is_active', true).order('name'),
      supabase.from('employees').select('id,employee_no,name,department,position')
        .eq('is_active', true).order('employee_no'),
      supabase.from('materials').select('id,name,unit,standard_price')
        .eq('is_active', true).order('code'),
    ])

  if (error || !po) notFound()

  return (
    <div className="p-8">
      <div className="mb-6">
        <div className="flex items-center gap-2 text-sm text-gray-500 mb-2">
          <Link href="/purchases" className="hover:text-gray-700">購買管理</Link>
          <span>/</span>
          <span className="text-gray-900">編集</span>
        </div>
        <h1 className="text-2xl font-bold text-gray-900">
          {po.po_number}
          <span className="ml-3 text-base font-normal text-gray-400">{po.supplier_name}</span>
        </h1>
      </div>
      <PurchaseOrderForm
        order={po}
        suppliers={suppliers ?? []}
        employees={employees ?? []}
        materials={materials ?? []}
      />
    </div>
  )
}
