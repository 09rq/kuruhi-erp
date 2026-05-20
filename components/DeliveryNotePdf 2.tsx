'use client'

import { useState } from 'react'
import { FileDown, Loader2 } from 'lucide-react'
import { createClient } from '@/lib/supabase/client'

interface Props {
  orderId: string
  orderNumber: string
}

export default function DeliveryNotePdf({ orderId, orderNumber }: Props) {
  const supabase = createClient()
  const [loading, setLoading] = useState(false)

  async function handleDownload() {
    setLoading(true)
    try {
      const { data: order } = await supabase
        .from('sales_orders')
        .select('*, customers(name, postal_code, address, contact_person, contact_department, phone, fax, invoice_number)')
        .eq('id', orderId)
        .single()

      if (!order) throw new Error('受注データが取得できません')

      const { data: items } = await supabase
        .from('sales_order_items')
        .select('*, products(name, product_no, brand_name)')
        .eq('order_id', orderId)
        .order('sort_order')

      const { data: company } = await supabase
        .from('company_settings')
        .select('*')
        .single()

      const { pdf, Document, Page, Text, View, StyleSheet, Font } = await import('@react-pdf/renderer')
      Font.register({ family: 'NotoSans', src: '/NotoSans.otf' })

      const customer = order.customers as {
        name: string; postal_code: string | null; address: string | null
        contact_person: string | null; contact_department: string | null
        phone: string | null; fax: string | null; invoice_number: string | null
      } | null

      const today = new Date().toLocaleDateString('ja-JP', { year: 'numeric', month: '2-digit', day: '2-digit' })
      const allItems = items || []
      const totalAmount = allItems.reduce((sum, item) => sum + (Number(item.amount) || 0), 0)
      const tax = Math.round(totalAmount * 0.1)
      const totalWithTax = totalAmount + tax

      // 1ページあたりの明細行数
      const ROWS_PER_HALF = 10

      // ページ分割
      const chunks: typeof allItems[] = []
      for (let i = 0; i < Math.max(1, Math.ceil(allItems.length / ROWS_PER_HALF)); i++) {
        chunks.push(allItems.slice(i * ROWS_PER_HALF, (i + 1) * ROWS_PER_HALF))
      }

      const styles = StyleSheet.create({
        page: { padding: 0, fontSize: 9, fontFamily: 'NotoSans' },
        half: { height: '50%', padding: 20, borderBottomWidth: 1, borderBottomColor: '#999', borderBottomStyle: 'dashed' },
        halfLast: { height: '50%', padding: 20 },
        pageNum: { fontSize: 7, textAlign: 'right', color: '#666', marginBottom: 2 },
        title: { fontSize: 16, fontWeight: 'bold', textAlign: 'center', marginBottom: 6, letterSpacing: 4 },
        headerRow: { flexDirection: 'row', justifyContent: 'space-between', marginBottom: 6 },
        leftBlock: { flex: 1.2 },
        rightBlock: { flex: 1, alignItems: 'flex-end' },
        customerName: { fontSize: 13, fontWeight: 'bold', marginBottom: 2 },
        customerSub: { fontSize: 8, color: '#333', marginBottom: 1 },
        companyName: { fontSize: 10, fontWeight: 'bold', marginBottom: 1 },
        companySub: { fontSize: 7.5, color: '#333', marginBottom: 1 },
        greeting: { fontSize: 8, marginBottom: 4 },
        assignedRow: { flexDirection: 'row', justifyContent: 'flex-end', marginBottom: 2 },
        assignedText: { fontSize: 8 },
        infoRow: { flexDirection: 'row', gap: 6, marginBottom: 4, fontSize: 8 },
        tableHeader: { flexDirection: 'row', borderTopWidth: 1, borderBottomWidth: 1, borderColor: '#333', paddingVertical: 3, backgroundColor: '#f0f0f0' },
        tableRow: { flexDirection: 'row', borderBottomWidth: 0.5, borderBottomColor: '#ccc', paddingVertical: 3, minHeight: 18 },
        colName: { flex: 4, paddingHorizontal: 3 },
        colQty: { width: 40, textAlign: 'right', paddingHorizontal: 3 },
        colUnit: { width: 28, textAlign: 'center', paddingHorizontal: 2 },
        colPrice: { width: 60, textAlign: 'right', paddingHorizontal: 3 },
        colAmount: { width: 65, textAlign: 'right', paddingHorizontal: 3 },
        colNotes: { flex: 1.5, paddingHorizontal: 3 },
        headerText: { fontSize: 8, fontWeight: 'bold' },
        totalSection: { flexDirection: 'row', borderTopWidth: 1, borderTopColor: '#333', paddingTop: 2, marginTop: 1 },
        totalLeft: { flex: 2, fontSize: 8 },
        totalRight: { flex: 3, flexDirection: 'row', justifyContent: 'flex-end', gap: 0 },
        totalBox: { width: 70, borderLeftWidth: 0.5, borderLeftColor: '#999', paddingHorizontal: 4 },
        totalLabel: { fontSize: 7, color: '#666', textAlign: 'center' },
        totalValue: { fontSize: 9, fontWeight: 'bold', textAlign: 'right' },
      })

      const HalfPage = ({ itemChunk, isControl, pageNum, totalPages, isLast }: {
        itemChunk: typeof allItems
        isControl: boolean
        pageNum: number
        totalPages: number
        isLast: boolean
      }) => {
        const emptyRows = Math.max(0, ROWS_PER_HALF - itemChunk.length)
        const showTotal = isLast

        return (
          <View style={isControl ? styles.halfLast : styles.half}>
            <Text style={styles.pageNum}>Page({pageNum}/{totalPages})　{isControl ? '納品書（控）' : '　'}</Text>

            <Text style={styles.title}>{isControl ? '納　品　書（控）' : '納　品　書'}</Text>

            <View style={styles.headerRow}>
              <View style={styles.leftBlock}>
                {customer?.postal_code && <Text style={styles.customerSub}>〒{customer.postal_code}</Text>}
                {customer?.address && <Text style={styles.customerSub}>{customer.address}</Text>}
                <Text style={styles.customerName}>{customer?.name || '　'}</Text>
                {customer?.contact_person && <Text style={styles.customerSub}>{customer.contact_person} 様</Text>}
              </View>
              <View style={styles.rightBlock}>
                <Text style={styles.companySub}>{today}</Text>
                <Text style={styles.companySub}>伝票NO：{order.order_number}</Text>
                <Text style={[styles.companyName, { marginTop: 4 }]}>{company?.name || '株式会社クルヒ'}</Text>
                {company?.postal_code && <Text style={styles.companySub}>〒{company.postal_code}</Text>}
                {company?.address && <Text style={styles.companySub}>{company.address}</Text>}
                {company?.phone && <Text style={styles.companySub}>TEL：{company.phone}{company?.fax ? `　FAX：${company.fax}` : ''}</Text>}
              </View>
            </View>

            <Text style={styles.greeting}>毎度ありがとうございます。下記の通り納品致しましたのでご査収下さい。</Text>

            <View style={styles.assignedRow}>
              <Text style={styles.assignedText}>担当：{company?.representative_name || '安田　明宏'}</Text>
            </View>

            <View style={styles.tableHeader}>
              <Text style={[styles.colName, styles.headerText]}>商品名</Text>
              <Text style={[styles.colQty, styles.headerText]}>数量</Text>
              <Text style={[styles.colUnit, styles.headerText]}>単位</Text>
              <Text style={[styles.colPrice, styles.headerText]}>単価</Text>
              <Text style={[styles.colAmount, styles.headerText]}>金額</Text>
              <Text style={[styles.colNotes, styles.headerText]}>備考</Text>
            </View>

            {itemChunk.map((item, idx) => {
              const product = item.products as { name: string; product_no: string } | null
              return (
                <View key={item.id} style={styles.tableRow}>
                  <Text style={styles.colName}>{product?.name || item.notes || '—'}</Text>
                  <Text style={styles.colQty}>{Number(item.quantity).toLocaleString()}</Text>
                  <Text style={styles.colUnit}>個</Text>
                  <Text style={styles.colPrice}>{item.unit_price ? Number(item.unit_price).toLocaleString() : '—'}</Text>
                  <Text style={styles.colAmount}>{item.amount ? Number(item.amount).toLocaleString() : '—'}</Text>
                  <Text style={styles.colNotes}>{item.notes || ''}</Text>
                </View>
              )
            })}

            {Array.from({ length: emptyRows }).map((_, i) => (
              <View key={`empty-${i}`} style={styles.tableRow}>
                <Text style={styles.colName}> </Text>
                <Text style={styles.colQty}> </Text>
                <Text style={styles.colUnit}> </Text>
                <Text style={styles.colPrice}> </Text>
                <Text style={styles.colAmount}> </Text>
                <Text style={styles.colNotes}> </Text>
              </View>
            ))}

            <View style={styles.totalSection}>
              <Text style={styles.totalLeft}> </Text>
              <View style={styles.totalRight}>
                <View style={styles.totalBox}>
                  <Text style={styles.totalLabel}>合計</Text>
                </View>
                <View style={styles.totalBox}>
                  <Text style={styles.totalLabel}>税抜</Text>
                  <Text style={styles.totalValue}>{showTotal ? totalAmount.toLocaleString() : ' '}</Text>
                </View>
                <View style={styles.totalBox}>
                  <Text style={styles.totalLabel}>消費税(10%)</Text>
                  <Text style={styles.totalValue}>{showTotal ? tax.toLocaleString() : ' '}</Text>
                </View>
                <View style={styles.totalBox}>
                  <Text style={styles.totalLabel}>総額</Text>
                  <Text style={styles.totalValue}>{showTotal ? totalWithTax.toLocaleString() : ' '}</Text>
                </View>
              </View>
            </View>
          </View>
        )
      }

      const MyDoc = () => (
        <Document>
          {chunks.map((chunk, pageIdx) => (
            <Page key={pageIdx} size="A4" style={styles.page} orientation="portrait">
              <HalfPage
                itemChunk={chunk}
                isControl={false}
                pageNum={pageIdx + 1}
                totalPages={chunks.length}
                isLast={pageIdx === chunks.length - 1}
              />
              <HalfPage
                itemChunk={chunk}
                isControl={true}
                pageNum={pageIdx + 1}
                totalPages={chunks.length}
                isLast={pageIdx === chunks.length - 1}
              />
            </Page>
          ))}
        </Document>
      )

      const blob = await pdf(<MyDoc />).toBlob()
      const url = URL.createObjectURL(blob)
      const a = document.createElement('a')
      a.href = url
      a.download = `納品書_${orderNumber}.pdf`
      a.click()
      URL.revokeObjectURL(url)
    } catch (e) {
      console.error(e)
      alert('PDF生成に失敗しました: ' + String(e))
    } finally { setLoading(false) }
  }

  return (
    <button
      onClick={handleDownload}
      disabled={loading}
      className="flex items-center gap-2 bg-green-700 text-white text-sm font-medium px-4 py-2 rounded-lg hover:bg-green-800 disabled:opacity-50"
    >
      {loading ? <Loader2 className="h-4 w-4 animate-spin" /> : <FileDown className="h-4 w-4" />}
      {loading ? 'PDF生成中...' : '納品書PDF'}
    </button>
  )
}
