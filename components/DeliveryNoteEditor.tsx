'use client'

import { useState, useEffect, useCallback } from 'react'
import { createClient } from '@/lib/supabase/client'
import { FileDown, Loader2, Plus, Trash2, Check } from 'lucide-react'

interface OrderItem {
  id: string
  product_id: string
  quantity: number
  unit_price: number
  amount: number
  notes: string | null
  products?: { name: string; product_no: string; brand_name: string | null }
}

interface DeliveryItem {
  sales_order_item_id: string
  product_name: string
  product_no: string
  quantity: number
  unit_price: number
  amount: number
  notes: string
  sort_order: number
}

interface Props {
  orderId: string
  orderNumber: string
}

export default function DeliveryNoteEditor({ orderId, orderNumber }: Props) {
  const supabase = createClient()
  const [orderItems, setOrderItems] = useState<OrderItem[]>([])
  const [deliveryItems, setDeliveryItems] = useState<DeliveryItem[]>([])
  const [deliveryDate, setDeliveryDate] = useState(new Date().toISOString().split('T')[0])
  const [notes, setNotes] = useState('')
  const [loading, setLoading] = useState(true)
  const [saving, setSaving] = useState(false)
  const [pdfLoading, setPdfLoading] = useState(false)
  const [message, setMessage] = useState<string | null>(null)
  const [showEditor, setShowEditor] = useState(false)

  const fetchData = useCallback(async () => {
    setLoading(true)
    try {
      const { data: items } = await supabase
        .from('sales_order_items')
        .select('*, products(name, product_no, brand_name)')
        .eq('order_id', orderId)
        .order('sort_order')
      setOrderItems(items || [])
      // 初期値として受注明細をセット
      setDeliveryItems((items || []).map((item, idx) => ({
        sales_order_item_id: item.id,
        product_name: (item.products as {name:string})?.name || '',
        product_no: (item.products as {product_no:string})?.product_no || '',
        quantity: item.quantity,
        unit_price: item.unit_price || 0,
        amount: item.amount || 0,
        notes: item.notes || '',
        sort_order: idx,
      })))
    } catch (e) { console.error(e) } finally { setLoading(false) }
  }, [supabase, orderId])

  useEffect(() => { fetchData() }, [fetchData])

  function updateItem(idx: number, updates: Partial<DeliveryItem>) {
    setDeliveryItems(prev => prev.map((item, i) => {
      if (i !== idx) return item
      const updated = { ...item, ...updates }
      if ('quantity' in updates || 'unit_price' in updates) {
        updated.amount = updated.quantity * updated.unit_price
      }
      return updated
    }))
  }

  function removeItem(idx: number) {
    setDeliveryItems(prev => prev.filter((_, i) => i !== idx))
  }

  async function handleSaveAndPdf() {
    setSaving(true)
    setMessage(null)
    try {
      const { data: { user } } = await supabase.auth.getUser()
      const seqResult = await supabase.rpc('nextval', { seq: 'delivery_note_seq' }).single()
      const deliveryNumber = `DN-${new Date().getFullYear()}-${String(seqResult.data || Date.now()).padStart(4, '0')}`

      const { data: dn, error } = await supabase.from('delivery_notes').insert({
        delivery_number: deliveryNumber,
        sales_order_id: orderId,
        delivery_date: deliveryDate,
        notes: notes || null,
        created_by: user?.id,
      }).select().single()

      if (error) throw error

      await supabase.from('delivery_note_items').insert(
        deliveryItems.map(item => ({
          delivery_note_id: dn.id,
          sales_order_item_id: item.sales_order_item_id,
          product_name: item.product_name,
          product_no: item.product_no,
          quantity: item.quantity,
          unit_price: item.unit_price,
          amount: item.amount,
          notes: item.notes || null,
          sort_order: item.sort_order,
        }))
      )

      setMessage('保存しました')
      await generatePdf(deliveryNumber)
    } catch (e) {
      console.error(e)
      setMessage('保存に失敗しました: ' + String(e))
    } finally { setSaving(false) }
  }

  async function generatePdf(deliveryNumber: string) {
    setPdfLoading(true)
    try {
      const { data: order } = await supabase
        .from('sales_orders')
        .select('*, customers(name, postal_code, address, contact_person, contact_department, phone, fax)')
        .eq('id', orderId).single()

      const { data: company } = await supabase.from('company_settings').select('*').single()

      const { pdf, Document, Page, Text, View, StyleSheet, Font } = await import('@react-pdf/renderer')
      Font.register({ family: 'NotoSans', src: '/NotoSans.otf' })

      const customer = order?.customers as { name: string; postal_code: string | null; address: string | null; contact_person: string | null; phone: string | null; fax: string | null } | null
      const totalAmount = deliveryItems.reduce((s, i) => s + i.amount, 0)
      const tax = Math.round(totalAmount * 0.1)
      const totalWithTax = totalAmount + tax
      const ROWS = 10
      const chunks: DeliveryItem[][] = []
      for (let i = 0; i < Math.max(1, Math.ceil(deliveryItems.length / ROWS)); i++) {
        chunks.push(deliveryItems.slice(i * ROWS, (i + 1) * ROWS))
      }

      const styles = StyleSheet.create({
        page: { padding: 0, fontSize: 9, fontFamily: 'NotoSans' },
        half: { height: '50%', paddingHorizontal: 25, paddingVertical: 15, borderBottomWidth: 1, borderBottomColor: '#aaa', borderBottomStyle: 'dashed' },
        halfCtrl: { height: '50%', paddingHorizontal: 25, paddingVertical: 15 },
        pageNum: { fontSize: 7, textAlign: 'right', color: '#888', marginBottom: 1 },
        title: { fontSize: 18, fontWeight: 'bold', textAlign: 'center', marginBottom: 8, letterSpacing: 6 },
        headerRow: { flexDirection: 'row', justifyContent: 'space-between', marginBottom: 6 },
        leftBlock: { flex: 1.3 },
        rightBlock: { flex: 1, alignItems: 'flex-end' },
        customerName: { fontSize: 13, fontWeight: 'bold', marginBottom: 1, paddingBottom: 2, borderBottomWidth: 1, borderBottomColor: '#333' },
        customerSub: { fontSize: 8, color: '#444', marginBottom: 1 },
        companyName: { fontSize: 10, fontWeight: 'bold', marginBottom: 1 },
        companySub: { fontSize: 8, color: '#444', marginBottom: 1 },
        greeting: { fontSize: 8, marginBottom: 3 },
        assignedRow: { textAlign: 'right', fontSize: 8, marginBottom: 3 },
        tableHeader: { flexDirection: 'row', backgroundColor: '#2c3e6b', paddingVertical: 4, paddingHorizontal: 2 },
        tableRow: { flexDirection: 'row', borderBottomWidth: 0.5, borderBottomColor: '#ddd', paddingVertical: 4, paddingHorizontal: 2, minHeight: 16 },
        tableRowAlt: { flexDirection: 'row', borderBottomWidth: 0.5, borderBottomColor: '#ddd', paddingVertical: 4, paddingHorizontal: 2, minHeight: 16, backgroundColor: '#f8f8f8' },
        colName: { flex: 4, paddingHorizontal: 2 },
        colQty: { width: 40, textAlign: 'right', paddingHorizontal: 2 },
        colUnit: { width: 24, textAlign: 'center' },
        colPrice: { width: 62, textAlign: 'right', paddingHorizontal: 2 },
        colAmount: { width: 68, textAlign: 'right', paddingHorizontal: 2 },
        colNotes: { flex: 1.5, paddingHorizontal: 2, flexWrap: 'wrap' },
        hText: { color: 'white', fontSize: 8, fontWeight: 'bold' },
        totalRow: { flexDirection: 'row', borderTopWidth: 1, borderTopColor: '#333', paddingTop: 3, marginTop: 2 },
        totalLeft: { flex: 2 },
        totalRight: { flex: 3, flexDirection: 'row' },
        totalBox: { flex: 1, borderLeftWidth: 0.5, borderLeftColor: '#aaa', paddingHorizontal: 3 },
        totalLabel: { fontSize: 7, color: '#666', textAlign: 'center' },
        totalValue: { fontSize: 9, fontWeight: 'bold', textAlign: 'right' },
      })

      const HalfDoc = ({ chunk, isCtrl, pageNum, totalPages, isLast }: { chunk: DeliveryItem[]; isCtrl: boolean; pageNum: number; totalPages: number; isLast: boolean }) => {
        const emptyRows = Math.max(0, ROWS - chunk.length)
        return (
          <View style={isCtrl ? styles.halfCtrl : styles.half}>
            <Text style={styles.pageNum}>Page({pageNum}/{totalPages})　{isCtrl ? '　納品書（控）' : ''}</Text>
            <Text style={styles.title}>{isCtrl ? '納　品　書（控）' : '納　品　書'}</Text>
            <View style={styles.headerRow}>
              <View style={styles.leftBlock}>
                {customer?.postal_code && <Text style={styles.customerSub}>〒{customer.postal_code}</Text>}
                {customer?.address && <Text style={styles.customerSub}>{customer.address}</Text>}
                <Text style={styles.customerName}>{customer?.name || '　'}</Text>
                {customer?.contact_person && <Text style={styles.customerSub}>{customer.contact_person} 様</Text>}
              </View>
              <View style={styles.rightBlock}>
                <Text style={styles.companySub}>{new Date(deliveryDate).toLocaleDateString('ja-JP')}</Text>
                <Text style={styles.companySub}>伝票NO：{deliveryNumber}</Text>
                <Text style={[styles.companyName, { marginTop: 4 }]}>{company?.name || '株式会社クルヒ'}</Text>
                {company?.postal_code && <Text style={styles.companySub}>〒{company.postal_code}</Text>}
                {company?.address && <Text style={styles.companySub}>{company.address}</Text>}
                {company?.phone && <Text style={styles.companySub}>TEL：{company.phone}{company?.fax ? `　FAX：${company.fax}` : ''}</Text>}
              </View>
            </View>
            <Text style={styles.greeting}>毎度ありがとうございます。下記の通り納品致しましたのでご査収下さい。</Text>
            <Text style={styles.assignedRow}>担当：{company?.representative_name || '安田　明宏'}</Text>
            <View style={styles.tableHeader}>
              <Text style={[styles.colName, styles.hText]}>商品名</Text>
              <Text style={[styles.colQty, styles.hText]}>数量</Text>
              <Text style={[styles.colUnit, styles.hText]}>単位</Text>
              <Text style={[styles.colPrice, styles.hText]}>単価</Text>
              <Text style={[styles.colAmount, styles.hText]}>金額</Text>
              <Text style={[styles.colNotes, styles.hText]}>備考</Text>
            </View>
            {chunk.map((item, idx) => (
              <View key={idx} style={idx % 2 === 0 ? styles.tableRow : styles.tableRowAlt}>
                <View style={styles.colName}>
                  <Text style={{ fontSize: 8, fontWeight: 'bold' }}>{item.product_name}</Text>
                  {item.product_no && <Text style={{ fontSize: 6.5, color: '#888' }}>{item.product_no}</Text>}
                </View>
                <Text style={styles.colQty}>{Number(item.quantity).toLocaleString()}</Text>
                <Text style={styles.colUnit}>個</Text>
                <Text style={styles.colPrice}>{item.unit_price ? Number(item.unit_price).toLocaleString() : '—'}</Text>
                <Text style={styles.colAmount}>{item.amount ? Number(item.amount).toLocaleString() : '—'}</Text>
                <Text style={[styles.colNotes, { flexWrap: 'wrap' }]}>{item.notes || ''}</Text>
              </View>
            ))}
            {Array.from({ length: emptyRows }).map((_, i) => (
              <View key={i} style={styles.tableRow}>
                <Text style={styles.colName}> </Text><Text style={styles.colQty}> </Text>
                <Text style={styles.colUnit}> </Text><Text style={styles.colPrice}> </Text>
                <Text style={styles.colAmount}> </Text><Text style={styles.colNotes}> </Text>
              </View>
            ))}
            <View style={styles.totalRow}>
              <Text style={styles.totalLeft}> </Text>
              <View style={styles.totalRight}>
                <View style={styles.totalBox}><Text style={styles.totalLabel}>合計</Text></View>
                <View style={styles.totalBox}>
                  <Text style={styles.totalLabel}>税抜</Text>
                  <Text style={styles.totalValue}>{isLast ? totalAmount.toLocaleString() : ' '}</Text>
                </View>
                <View style={styles.totalBox}>
                  <Text style={styles.totalLabel}>消費税(10%)</Text>
                  <Text style={styles.totalValue}>{isLast ? tax.toLocaleString() : ' '}</Text>
                </View>
                <View style={styles.totalBox}>
                  <Text style={styles.totalLabel}>総額</Text>
                  <Text style={styles.totalValue}>{isLast ? totalWithTax.toLocaleString() : ' '}</Text>
                </View>
              </View>
            </View>
          </View>
        )
      }

      const MyDoc = () => (
        <Document>
          {chunks.map((chunk, pageIdx) => (
            <Page key={pageIdx} size="A4" style={styles.page}>
              <HalfDoc chunk={chunk} isCtrl={false} pageNum={pageIdx+1} totalPages={chunks.length} isLast={pageIdx===chunks.length-1} />
              <HalfDoc chunk={chunk} isCtrl={true} pageNum={pageIdx+1} totalPages={chunks.length} isLast={pageIdx===chunks.length-1} />
            </Page>
          ))}
        </Document>
      )

      const blob = await pdf(<MyDoc />).toBlob()
      const url = URL.createObjectURL(blob)
      const a = document.createElement('a')
      a.href = url
      a.download = `納品書_${deliveryNumber}.pdf`
      a.click()
      URL.revokeObjectURL(url)
    } catch (e) {
      console.error(e)
      alert('PDF生成に失敗しました: ' + String(e))
    } finally { setPdfLoading(false) }
  }

  const totalAmount = deliveryItems.reduce((s, i) => s + i.amount, 0)
  const tax = Math.round(totalAmount * 0.1)

  if (loading) return <div className="animate-spin rounded-full h-5 w-5 border-b-2 border-blue-600 mx-auto" />

  return (
    <div className="mt-4">
      <button
        onClick={() => setShowEditor(!showEditor)}
        className="flex items-center gap-2 bg-green-700 text-white text-sm font-medium px-4 py-2 rounded-lg hover:bg-green-800"
      >
        <FileDown className="h-4 w-4" />
        納品書を作成・PDF出力
      </button>

      {showEditor && (
        <div className="mt-4 bg-gray-50 border border-gray-200 rounded-2xl p-5">
          <h3 className="text-sm font-bold text-gray-900 mb-4">納品書作成</h3>

          <div className="mb-4">
            <label className="text-xs font-medium text-gray-600 mb-1 block">納品日 *</label>
            <input type="date" value={deliveryDate} onChange={e => setDeliveryDate(e.target.value)}
              className="w-48 text-sm border border-gray-300 rounded-lg px-3 py-2 focus:outline-none focus:ring-2 focus:ring-blue-500" />
          </div>

          <div className="bg-white border border-gray-200 rounded-xl overflow-hidden mb-4">
            <div className="grid grid-cols-12 bg-gray-50 px-3 py-2 text-xs font-medium text-gray-500 border-b border-gray-200">
              <div className="col-span-3">商品名</div>
              <div className="col-span-1 text-right">受注数</div>
              <div className="col-span-2 text-right">納品数量</div>
              <div className="col-span-2 text-right">単価</div>
              <div className="col-span-2 text-right">金額</div>
              <div className="col-span-1">備考</div>
              <div className="col-span-1"></div>
            </div>
            {deliveryItems.map((item, idx) => {
              const orderItem = orderItems.find(o => o.id === item.sales_order_item_id)
              const remaining = orderItem ? orderItem.quantity - item.quantity : 0
              return (
                <div key={idx} className="grid grid-cols-12 px-3 py-2 border-b border-gray-100 hover:bg-gray-50 items-center gap-1">
                  <div className="col-span-3">
                    <p className="text-xs font-medium text-gray-900">{item.product_name}</p>
                    <p className="text-xs text-gray-400">{item.product_no}</p>
                  </div>
                  <div className="col-span-1 text-xs text-right text-gray-500">
                    {orderItem?.quantity || '-'}個
                  </div>
                  <div className="col-span-2 flex items-center gap-1 justify-end">
                    <input type="number" value={item.quantity} min={0}
                      onChange={e => updateItem(idx, { quantity: Number(e.target.value) })}
                      className="w-16 text-xs text-right border border-gray-200 rounded px-2 py-1 focus:outline-none focus:ring-1 focus:ring-blue-500" />
                    <span className="text-xs text-gray-400">個</span>
                    {remaining > 0 && <span className="text-xs text-orange-500">残{remaining}</span>}
                  </div>
                  <div className="col-span-2 flex items-center gap-1 justify-end">
                    <input type="number" value={item.unit_price}
                      onChange={e => updateItem(idx, { unit_price: Number(e.target.value) })}
                      className="w-20 text-xs text-right border border-gray-200 rounded px-2 py-1 focus:outline-none focus:ring-1 focus:ring-blue-500" />
                  </div>
                  <div className="col-span-2 text-xs text-right font-medium text-gray-900">
                    ¥{item.amount.toLocaleString()}
                  </div>
                  <div className="col-span-1">
                    <input type="text" value={item.notes}
                      onChange={e => updateItem(idx, { notes: e.target.value })}
                      placeholder="備考"
                      className="w-full text-xs border border-gray-200 rounded px-2 py-1 focus:outline-none focus:ring-1 focus:ring-blue-500" />
                  </div>
                  <div className="col-span-1 flex justify-center">
                    <button onClick={() => removeItem(idx)} className="text-gray-300 hover:text-red-500">
                      <Trash2 className="h-3.5 w-3.5" />
                    </button>
                  </div>
                </div>
              )
            })}
          </div>

          <div className="flex items-center justify-between">
            <div className="text-sm text-gray-600">
              小計: <span className="font-bold">¥{totalAmount.toLocaleString()}</span>
              　消費税: <span className="font-bold">¥{tax.toLocaleString()}</span>
              　合計: <span className="font-bold text-blue-700">¥{(totalAmount + tax).toLocaleString()}</span>
            </div>
            <div className="flex items-center gap-2">
              {message && <span className={`text-xs ${message.includes('失敗') ? 'text-red-600' : 'text-green-600'}`}>{message}</span>}
              <button onClick={handleSaveAndPdf} disabled={saving || pdfLoading}
                className="flex items-center gap-2 bg-green-700 text-white text-sm font-medium px-4 py-2 rounded-lg hover:bg-green-800 disabled:opacity-50">
                {saving || pdfLoading ? <Loader2 className="h-4 w-4 animate-spin" /> : <FileDown className="h-4 w-4" />}
                {saving ? '保存中...' : pdfLoading ? 'PDF生成中...' : '保存してPDF出力'}
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  )
}
