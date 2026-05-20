import { renderToBuffer, type DocumentProps } from '@react-pdf/renderer'
import { createElement, type JSXElementConstructor, type ReactElement } from 'react'
import { Resend } from 'resend'
import { createClient } from '@/lib/supabase/server'
import PurchaseOrderPDFDoc from '@/app/(dashboard)/purchases/[id]/preview/PurchaseOrderPDFDoc'

export async function POST(
  req: Request,
  { params }: { params: Promise<{ id: string }> }
) {
  const { id } = await params
  const { subject, body } = await req.json() as { subject: string; body: string }

  const supabase = await createClient()

  const [{ data: po, error }, { data: company }] = await Promise.all([
    supabase
      .from('purchase_orders')
      .select('*, items:purchase_order_items(*), supplier:customers(email)')
      .eq('id', id)
      .order('sort_order', { referencedTable: 'purchase_order_items' })
      .single(),
    supabase.from('company_info').select('*').limit(1).maybeSingle(),
  ])

  if (error || !po) {
    return Response.json({ error: '発注書が見つかりません' }, { status: 404 })
  }

  const toEmail = (po.supplier as { email?: string | null } | null)?.email
  if (!toEmail) {
    return Response.json({ error: '発注先にメールアドレスが登録されていません' }, { status: 400 })
  }

  const resendKey = process.env.RESEND_API_KEY
  if (!resendKey) {
    return Response.json({ error: 'RESEND_API_KEY が設定されていません' }, { status: 500 })
  }

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
  const pdfBuffer = await (renderToBuffer as (e: any) => Promise<Buffer>)(
    createElement(PurchaseOrderPDFDoc as never, { order: po, company: companyInfo, employeeName })
  )

  const resend = new Resend(resendKey)
  const fromAddress = process.env.RESEND_FROM ?? 'no-reply@example.com'

  const { error: sendError } = await resend.emails.send({
    from: fromAddress,
    to: toEmail,
    subject,
    text: body,
    attachments: [
      {
        filename: `${po.po_number}.pdf`,
        content: Buffer.from(pdfBuffer),
      },
    ],
  })

  if (sendError) {
    return Response.json({ error: sendError.message }, { status: 500 })
  }

  return Response.json({ ok: true })
}
