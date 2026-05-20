'use client'

import type { Product } from '@/lib/types/product'
import { PRODUCT_STATUS_LABELS } from '@/lib/types/product'

interface Row extends Product {
  category?: { name: string } | null
  client?: { name: string } | null
  computed_cost?: number | null
}

interface Props { products: Row[] }

const CSV_HEADERS = [
  '品番', '品名', 'ブランド名', 'シリーズ名', 'カテゴリ', 'クライアント', 'クライアント品番',
  'ステータス', '幅(mm)', '高さ(mm)', '奥行(mm)',
  '不良率込み原価', '販売単価', '粗利額', '粗利率(%)',
]

function escapeCSV(v: string | null | undefined): string {
  const s = v ?? ''
  if (s.includes(',') || s.includes('"') || s.includes('\n')) {
    return `"${s.replace(/"/g, '""')}"`
  }
  return s
}

export default function ProductCSVButton({ products }: Props) {
  const handleDownload = () => {
    const rows = products.map((p) => {
      const cost = p.computed_cost ?? null
      const gp = p.selling_price != null && cost != null ? p.selling_price - cost : null
      const gpRate = gp != null && p.selling_price ? ((gp / p.selling_price) * 100).toFixed(1) : ''

      return [
        p.product_no,
        p.name,
        p.brand_name ?? '',
        p.series_name ?? '',
        p.category?.name ?? '',
        p.client?.name ?? '',
        p.client_product_no ?? '',
        PRODUCT_STATUS_LABELS[p.status],
        p.width_mm?.toString() ?? '',
        p.height_mm?.toString() ?? '',
        p.depth_mm?.toString() ?? '',
        cost?.toString() ?? '',
        p.selling_price?.toString() ?? '',
        gp?.toString() ?? '',
        gpRate,
      ]
    })

    const csvLines = [
      CSV_HEADERS.join(','),
      ...rows.map((r) => r.map(escapeCSV).join(',')),
    ]
    const bom = '\uFEFF'
    const blob = new Blob([bom + csvLines.join('\r\n')], { type: 'text/csv;charset=utf-8;' })
    const url = URL.createObjectURL(blob)
    const today = new Date()
    const yyyymmdd = `${today.getFullYear()}${String(today.getMonth() + 1).padStart(2, '0')}${String(today.getDate()).padStart(2, '0')}`
    const a = document.createElement('a')
    a.href = url
    a.download = `製品マスタ_${yyyymmdd}.csv`
    a.click()
    URL.revokeObjectURL(url)
  }

  return (
    <button
      onClick={handleDownload}
      className="inline-flex items-center gap-2 px-4 py-2 rounded-lg text-sm font-medium border border-gray-300 text-gray-700 bg-white hover:bg-gray-50 transition-colors"
    >
      <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2}
          d="M4 16v1a3 3 0 003 3h10a3 3 0 003-3v-1m-4-4l-4 4m0 0l-4-4m4 4V4" />
      </svg>
      CSVダウンロード
    </button>
  )
}
