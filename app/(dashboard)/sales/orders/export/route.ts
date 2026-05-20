import { NextRequest, NextResponse } from 'next/server'
import { createClient } from '@/lib/supabase/server'
import { SO_STATUS_LABELS, type SOStatus } from '@/lib/types/sales-order'

function fmtDate(d: string | null) {
  if (!d) return ''
  return new Date(d).toLocaleDateString('ja-JP', { year: 'numeric', month: '2-digit', day: '2-digit' })
}

function escapeCsv(val: string | number | null | undefined): string {
  if (val == null) return ''
  const s = String(val)
  return s.includes(',') || s.includes('"') || s.includes('\n')
    ? `"${s.replace(/"/g, '""')}"`
    : s
}

export async function GET(req: NextRequest) {
  const supabase = await createClient()
  const { searchParams } = req.nextUrl
  const q      = searchParams.get('q') ?? ''
  const status = searchParams.get('status') ?? ''

  let query = supabase
    .from('sales_orders')
    .select(`
      order_number, order_date, desired_delivery_date, confirmed_delivery_date, status, notes,
      customers ( name ),
      sales_order_items ( amount )
    `)
    .order('order_date', { ascending: false })
    .order('order_number', { ascending: false })

  if (status && status !== 'all') query = query.eq('status', status)
  if (q) query = query.or(`order_number.ilike.%${q}%`)

  const { data: orders, error } = await query
  if (error) return NextResponse.json({ error: error.message }, { status: 500 })

  const header = ['受注番号', 'クライアント', '受注日', '希望納期', '確定納期', '金額合計', 'ステータス', '備考'].join(',')
  const rows = (orders ?? []).map((o) => {
    const client  = Array.isArray(o.customers) ? o.customers[0] : o.customers
    const total   = (o.sales_order_items ?? []).reduce((s: number, i: { amount: number }) => s + Number(i.amount), 0)
    return [
      escapeCsv(o.order_number),
      escapeCsv(client?.name),
      escapeCsv(fmtDate(o.order_date)),
      escapeCsv(fmtDate(o.desired_delivery_date)),
      escapeCsv(fmtDate(o.confirmed_delivery_date)),
      escapeCsv(Math.round(total)),
      escapeCsv(SO_STATUS_LABELS[o.status as SOStatus] ?? o.status),
      escapeCsv(o.notes),
    ].join(',')
  })

  const csv  = '\uFEFF' + [header, ...rows].join('\r\n')
  const date = new Date().toISOString().slice(0, 10).replace(/-/g, '')

  return new NextResponse(csv, {
    status: 200,
    headers: {
      'Content-Type': 'text/csv; charset=utf-8',
      'Content-Disposition': `attachment; filename*=UTF-8''${encodeURIComponent(`受注一覧_${date}.csv`)}`,
    },
  })
}
