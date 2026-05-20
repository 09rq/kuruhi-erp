import { NextRequest, NextResponse } from 'next/server'
import { createClient } from '@/lib/supabase/server'

function fmtDate(d: string | null) {
  if (!d) return ''
  return new Date(d).toLocaleDateString('ja-JP', { year: 'numeric', month: '2-digit', day: '2-digit' })
}

function escapeCsv(val: string | number | null | undefined): string {
  if (val == null) return ''
  const s = String(val)
  if (s.includes(',') || s.includes('"') || s.includes('\n')) {
    return `"${s.replace(/"/g, '""')}"`
  }
  return s
}

export async function GET(req: NextRequest) {
  const supabase = await createClient()
  const { searchParams } = req.nextUrl
  const q        = searchParams.get('q') ?? ''
  const category = searchParams.get('category') ?? ''

  let query = supabase
    .from('materials')
    .select('code, name, category, current_stock, unit, standard_price, stock_updated_at, min_stock')
    .order('category')
    .order('name')

  if (category && category !== 'all') query = query.eq('category', category)
  if (q) query = query.or(`name.ilike.%${q}%,code.ilike.%${q}%`)

  const { data: materials, error } = await query
  if (error) {
    return NextResponse.json({ error: error.message }, { status: 500 })
  }

  const header = ['材料コード', '材料名', '区分', '現在庫', '単位', '在庫金額', '最終更新日'].join(',')
  const rows = (materials ?? []).map((m) => {
    const stockValue = m.current_stock != null && m.standard_price != null
      ? Math.round(Number(m.current_stock) * Number(m.standard_price))
      : ''
    return [
      escapeCsv(m.code),
      escapeCsv(m.name),
      escapeCsv(m.category),
      escapeCsv(m.current_stock),
      escapeCsv(m.unit),
      escapeCsv(stockValue),
      escapeCsv(fmtDate(m.stock_updated_at)),
    ].join(',')
  })

  const csv = '\uFEFF' + [header, ...rows].join('\r\n')
  const date = new Date().toISOString().slice(0, 10).replace(/-/g, '')

  return new NextResponse(csv, {
    status: 200,
    headers: {
      'Content-Type': 'text/csv; charset=utf-8',
      'Content-Disposition': `attachment; filename*=UTF-8''${encodeURIComponent(`材料在庫_${date}.csv`)}`,
    },
  })
}
