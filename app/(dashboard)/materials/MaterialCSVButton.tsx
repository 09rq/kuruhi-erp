'use client'

interface MaterialRow {
  code: string
  name: string
  short_name: string | null
  category: string
  procurement_type?: string | null
  supplier: { name: string } | null
  unit: string
  standard_price: number | null
  current_stock: number
  safety_stock: number | null
  note: string | null
}

interface Props { materials: MaterialRow[] }

const CSV_HEADERS = [
  '材料コード', '材料名', '略称', '区分', '調達区分',
  '仕入先', '単位', '標準単価', '在庫数', '在庫金額', '最低在庫数', '備考',
]

function escapeCSV(v: string | null | undefined): string {
  const s = v ?? ''
  if (s.includes(',') || s.includes('"') || s.includes('\n')) {
    return `"${s.replace(/"/g, '""')}"`
  }
  return s
}

export default function MaterialCSVButton({ materials }: Props) {
  const handleDownload = () => {
    const rows = materials.map((m) => {
      const stockValue = Math.round(m.current_stock * (m.standard_price ?? 0))
      return [
        m.code,
        m.name,
        m.short_name ?? '',
        m.category,
        m.procurement_type === 'supplied' ? '支給' : '買い',
        m.supplier?.name ?? '',
        m.unit,
        m.standard_price?.toString() ?? '',
        m.current_stock.toString(),
        stockValue.toString(),
        m.safety_stock?.toString() ?? '',
        m.note ?? '',
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
    a.download = `材料一覧_${yyyymmdd}.csv`
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
