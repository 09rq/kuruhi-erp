import { renderToBuffer, type DocumentProps } from '@react-pdf/renderer'
import { createElement, type JSXElementConstructor, type ReactElement } from 'react'
import { createClient } from '@/lib/supabase/server'
import { notFound } from 'next/navigation'
import PurchaseOrderPDFDoc from '@/app/(dashboard)/purchases/[id]/preview/PurchaseOrderPDFDoc'

export async function GET(
  _req: Request,
  { params }: { params: Promise<{ id: string }> }
) {
  const { id } = await params
  const supabase = await createClient()

  const [{ data: po, error }, { data: company }] = await Promise.all([
    supabase
      .from('purchase_orders')
      .select('*, items:purchase_order_items(*)')
      .eq('id', id)
      .order('sort_order', { referencedTable: 'purchase_order_items' })
      .single(),
    supabase.from('company_info').select('*').limit(1).maybeSingle(),
  ])

  if (error || !po) return notFound()

  let employeeName: string | undefined
  if (po.assigned_employee_id) {
    const { data: emp } = await supabase
      .from('employees').select('name').eq('id', po.assigned_employee_id).single()
    employeeName = emp?.name
  }

  const companyInfo = {
    name: company?.name ?? '株式会社クルヒ',
    address: company?.address ?? null,
    phone: company?.phone ?? null,
    fax: company?.fax ?? null,
    invoice_number: company?.invoice_number ?? null,
  }

  // @react-pdf/renderer の型制約を回避
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const buffer = await (renderToBuffer as (e: any) => Promise<Buffer>)(
    createElement(PurchaseOrderPDFDoc as never, { order: po, company: companyInfo, employeeName })
  )

  return new Response(buffer as unknown as BodyInit, {
    headers: {
      'Content-Type': 'application/pdf',
      'Content-Disposition': `attachment; filename="${po.po_number}.pdf"`,
    },
  })
}
