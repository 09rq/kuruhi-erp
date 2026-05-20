import { notFound } from 'next/navigation'
import { createClient } from '@/lib/supabase/server'
import PreviewClient from './PreviewClient'

export default async function PurchaseOrderPreviewPage({
  params,
}: {
  params: Promise<{ id: string }>
}) {
  const { id } = await params
  const supabase = await createClient()

  const [{ data: po, error }, { data: company }, ] = await Promise.all([
    supabase
      .from('purchase_orders')
      .select('*, items:purchase_order_items(*)')
      .eq('id', id)
      .order('sort_order', { referencedTable: 'purchase_order_items' })
      .single(),
    supabase.from('company_info').select('*').limit(1).maybeSingle(),
  ])

  if (error || !po) notFound()

  let employeeName: string | undefined
  if (po.assigned_employee_id) {
    const { data: emp } = await supabase
      .from('employees')
      .select('name')
      .eq('id', po.assigned_employee_id)
      .single()
    employeeName = emp?.name
  }

  return (
    <div className="h-full flex flex-col" style={{ height: 'calc(100vh - 0px)' }}>
      <PreviewClient
        order={po}
        company={{
          name: company?.name ?? '株式会社クルヒ',
          address: company?.address ?? null,
          phone: company?.phone ?? null,
          fax: company?.fax ?? null,
          invoice_number: company?.invoice_number ?? null,
        }}
        employeeName={employeeName}
      />
    </div>
  )
}
