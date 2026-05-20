import { renderToBuffer } from '@react-pdf/renderer'
import { createElement } from 'react'
import { createClient } from '@/lib/supabase/server'
import EstimatePDFDoc from '@/app/(dashboard)/estimates/[id]/EstimatePDFDoc'

export async function GET(
  _req: Request,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const { id } = await params
    const supabase = await createClient()

    const [{ data: est, error }, { data: company }] = await Promise.all([
      supabase
        .from('estimates')
        .select('*, client:customers(name), items:estimate_items(*)')
        .eq('id', id)
        .order('sort_order', { referencedTable: 'estimate_items' })
        .single(),
      supabase.from('company_info').select('*').limit(1).maybeSingle(),
    ])

    if (error) {
      console.error('[estimates/pdf] DB error:', error)
      return new Response(JSON.stringify({ error: error.message }), { status: 500 })
    }
    if (!est) {
      return new Response(JSON.stringify({ error: 'Not found' }), { status: 404 })
    }

    const companyInfo = {
      name:        company?.name        ?? '株式会社クルヒ',
      postal_code: company?.postal_code ?? null,
      address:     company?.address     ?? null,
      phone:       company?.phone       ?? null,
      fax:         company?.fax         ?? null,
    }

    const estimateData = {
      estimate_number: est.estimate_number,
      client_name:     (est.client as { name?: string } | null)?.name ?? null,
      client_contact:  est.client_contact,
      issue_date:      est.issue_date,
      expiry_date:     est.expiry_date,
      subject:         est.subject,
      delivery_date:   est.delivery_date,
      total_amount:    est.total_amount,
      tax_amount:      est.tax_amount,
      grand_total:     est.grand_total,
      payment_terms:   est.payment_terms,
      notes:           est.notes,
      items:           (est.items ?? []) as Array<{
        id: string; sort_order: number; item_name: string
        quantity: number | null; unit: string | null
        unit_price: number | null; amount: number; notes: string | null
      }>,
    }

    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    const buffer = await (renderToBuffer as (e: any) => Promise<Buffer>)(
      createElement(EstimatePDFDoc as never, { estimate: estimateData, company: companyInfo })
    )

    return new Response(buffer as unknown as BodyInit, {
      headers: {
        'Content-Type': 'application/pdf',
        'Content-Disposition': `inline; filename="${est.estimate_number}.pdf"`,
      },
    })
  } catch (err) {
    console.error('[estimates/pdf] Unhandled error:', err)
    return new Response(
      JSON.stringify({ error: err instanceof Error ? err.message : String(err) }),
      { status: 500, headers: { 'Content-Type': 'application/json' } }
    )
  }
}
