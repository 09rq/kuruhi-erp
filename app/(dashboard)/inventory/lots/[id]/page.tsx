import Link from 'next/link'
import { notFound } from 'next/navigation'
import { createClient } from '@/lib/supabase/server'
import { LOT_STATUS_LABELS, LOT_STATUS_COLORS, type LotStatus } from '@/lib/types/inventory'
import LotStatusButton from './LotStatusButton'
import ProcessesEditor from './ProcessesEditor'

function fmtDate(d: string | null) {
  if (!d) return '—'
  return new Date(d).toLocaleDateString('ja-JP', { year: 'numeric', month: '2-digit', day: '2-digit' })
}

export default async function LotDetailPage({
  params,
}: {
  params: Promise<{ id: string }>
}) {
  const { id } = await params
  const supabase = await createClient()

  const [{ data: lot }, { data: vendors }] = await Promise.all([
    supabase
      .from('production_lots')
      .select(`
        id, lot_number, planned_quantity, completed_quantity, status,
        started_at, completed_at, notes, created_at,
        products ( name, product_no ),
        product_variants ( color_name, size_label ),
        production_lot_processes (
          id, sort_order, process_name, vendor_id, planned_quantity,
          unit_price, amount, purchase_status, purchase_date, wip_value, notes,
          customers ( name )
        )
      `)
      .eq('id', id)
      .single(),
    supabase
      .from('customers')
      .select('id, name')
      .eq('type', 'vendor_processing')
      .eq('is_active', true)
      .order('name'),
  ])

  if (!lot) notFound()

  const product = Array.isArray(lot.products) ? lot.products[0] : lot.products
  const variant = Array.isArray(lot.product_variants) ? lot.product_variants[0] : lot.product_variants

  const rawProcesses = [...(lot.production_lot_processes ?? [])].sort(
    (a: { sort_order: number }, b: { sort_order: number }) => a.sort_order - b.sort_order,
  )

  // ProcessesEditor に渡す整形済みデータ
  const initialProcesses = rawProcesses.map((p: {
    id: string; sort_order: number; process_name: string; vendor_id: string | null;
    planned_quantity: number; unit_price: number; amount: number;
    purchase_status: string; purchase_date: string | null;
    wip_value: number; notes: string | null;
    customers: { name: string } | { name: string }[] | null;
  }) => ({
    id:               p.id,
    sort_order:       p.sort_order,
    process_name:     p.process_name,
    vendor_id:        p.vendor_id ?? '',
    vendor_name:      (Array.isArray(p.customers) ? p.customers[0] : p.customers)?.name ?? null,
    planned_quantity: String(p.planned_quantity),
    unit_price:       String(p.unit_price),
    purchase_status:  p.purchase_status as 'unpaid' | 'paid',
    purchase_date:    p.purchase_date,
    notes:            p.notes ?? '',
  }))

  return (
    <div className="p-8">
      {/* ─── ヘッダー ─── */}
      <div className="flex items-start justify-between mb-6">
        <div>
          <div className="mb-1">
            <Link href="/inventory/lots" className="text-xs text-gray-400 hover:text-gray-600">
              ← 製造ロット一覧
            </Link>
          </div>
          <h1 className="text-2xl font-bold text-gray-900 font-mono">{lot.lot_number}</h1>
          <p className="mt-1 text-sm text-gray-600">
            {product ? `${product.product_no} — ${product.name}` : '—'}
            {variant && (
              <span className="ml-2 text-xs text-gray-400">
                {[variant.color_name, variant.size_label].filter(Boolean).join(' / ')}
              </span>
            )}
          </p>
        </div>
        <div className="flex items-center gap-3">
          <span className={`inline-block px-3 py-1 rounded-full text-sm font-medium ${LOT_STATUS_COLORS[lot.status as LotStatus] ?? 'bg-gray-100 text-gray-600'}`}>
            {LOT_STATUS_LABELS[lot.status as LotStatus] ?? lot.status}
          </span>
          <LotStatusButton lotId={lot.id} currentStatus={lot.status as LotStatus} />
        </div>
      </div>

      {/* ─── ロット基本情報 ─── */}
      <div className="bg-white rounded-xl border border-gray-200 p-5 mb-6">
        <p className="text-xs font-semibold text-gray-600 mb-3">ロット情報</p>
        <div className="grid grid-cols-4 gap-4 text-sm">
          <div>
            <p className="text-xs text-gray-400 mb-0.5">予定数量</p>
            <p className="text-gray-800 font-mono font-semibold">
              {lot.planned_quantity.toLocaleString('ja-JP')}
            </p>
          </div>
          <div>
            <p className="text-xs text-gray-400 mb-0.5">完了数量</p>
            <p className="text-gray-800 font-mono font-semibold">
              {lot.completed_quantity.toLocaleString('ja-JP')}
            </p>
          </div>
          <div>
            <p className="text-xs text-gray-400 mb-0.5">開始日</p>
            <p className="text-gray-700">{fmtDate(lot.started_at)}</p>
          </div>
          <div>
            <p className="text-xs text-gray-400 mb-0.5">完了日</p>
            <p className="text-gray-700">{fmtDate(lot.completed_at)}</p>
          </div>
          {lot.notes && (
            <div className="col-span-4">
              <p className="text-xs text-gray-400 mb-0.5">備考</p>
              <p className="text-gray-700 whitespace-pre-wrap">{lot.notes}</p>
            </div>
          )}
        </div>
      </div>

      {/* ─── 加工工程エディタ（Client Component）─── */}
      <ProcessesEditor
        lotId={lot.id}
        initialProcesses={initialProcesses}
        vendors={vendors ?? []}
      />
    </div>
  )
}
