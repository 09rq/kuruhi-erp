'use client'

import type { Customer, CustomerType } from '@/lib/types/customer'
import { CUSTOMER_TYPE_LABELS } from '@/lib/types/customer'

interface Props {
  customers: Customer[]
}

const CSV_HEADERS = [
  'コード',
  '区分',
  '詳細区分',
  '会社名',
  'フリガナ',
  '担当者',
  '電話番号',
  '携帯電話',
  'FAX',
  'メールアドレス',
  '郵便番号',
  '住所',
  '支払条件',
  'インボイス登録番号',
  'ステータス',
]

function escapeCSV(value: string | null | undefined): string {
  const str = value ?? ''
  // ダブルクォートと改行を含む場合はクォートで囲む
  if (str.includes(',') || str.includes('"') || str.includes('\n')) {
    return `"${str.replace(/"/g, '""')}"`
  }
  return str
}

export default function CustomerCSVButton({ customers }: Props) {
  const handleDownload = () => {
    const rows = customers.map((c) => [
      c.code,
      CUSTOMER_TYPE_LABELS[c.type as CustomerType] ?? c.type,
      c.sub_category ?? '',
      c.name,
      c.name_kana ?? '',
      c.contact_person ?? '',
      c.phone ?? '',
      c.mobile ?? '',
      c.fax ?? '',
      c.email ?? '',
      c.postal_code ?? '',
      c.address ?? '',
      c.payment_terms ?? '',
      c.invoice_number ?? '',
      c.is_active ? '有効' : '無効',
    ])

    const csvLines = [
      CSV_HEADERS.join(','),
      ...rows.map((r) => r.map(escapeCSV).join(',')),
    ]

    // UTF-8 BOM付き（Excelで文字化けしない）
    const bom = '\uFEFF'
    const csvContent = bom + csvLines.join('\r\n')

    const blob = new Blob([csvContent], { type: 'text/csv;charset=utf-8;' })
    const url = URL.createObjectURL(blob)

    const today = new Date()
    const yyyymmdd = `${today.getFullYear()}${String(today.getMonth() + 1).padStart(2, '0')}${String(today.getDate()).padStart(2, '0')}`

    const a = document.createElement('a')
    a.href = url
    a.download = `取引先一覧_${yyyymmdd}.csv`
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
