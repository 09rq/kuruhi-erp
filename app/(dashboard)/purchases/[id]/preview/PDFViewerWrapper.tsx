'use client'

import { usePDF } from '@react-pdf/renderer'
import PurchaseOrderPDFDoc from './PurchaseOrderPDFDoc'
import type { PurchaseOrder, PurchaseOrderItem } from '@/lib/types/purchase-order'

interface CompanyInfo {
  name: string
  address: string | null
  phone: string | null
  fax: string | null
  invoice_number: string | null
}

interface Props {
  order: PurchaseOrder & { items: PurchaseOrderItem[] }
  company: CompanyInfo
  employeeName?: string
}

export default function PDFViewerWrapper({ order, company, employeeName }: Props) {
  const [instance] = usePDF({
    document: (
      <PurchaseOrderPDFDoc order={order} company={company} employeeName={employeeName} />
    ),
  })

  if (instance.loading) {
    return (
      <div className="flex items-center justify-center h-full text-gray-400 text-sm">
        PDF を生成中...
      </div>
    )
  }

  if (instance.error) {
    return (
      <div className="flex items-center justify-center h-full text-red-500 text-sm px-8 text-center">
        PDF 生成エラー: {String(instance.error)}
      </div>
    )
  }

  return (
    <iframe
      src={instance.url ?? undefined}
      width="100%"
      height="100%"
      style={{ border: 'none', display: 'block' }}
      title="発注書プレビュー"
    />
  )
}
