'use client'

import { useState, useEffect, useCallback } from 'react'
import { createClient } from '@/lib/supabase/client'
import { FileDown, Loader2, Plus, Trash2, RefreshCw } from 'lucide-react'
import SearchableSelect from '@/components/SearchableSelect'

interface DeliveryItem {
  sales_order_item_id: string | null
  product_id: string | null
  product_name: string
  product_no: string
  quantity: number
  unit_price: number
  amount: number
  unit_cost: number
  cost_amount: number
  cost_overridden: boolean
  notes: string
}

const DELIVERY_TYPES = ['量産', 'サンプル', '修理', 'その他'] as const

export default function QuickDeliveryNote() {
  const supabase = createClient()
  const [customers, setCustomers] = useState<{ id: string; name: string }[]>([])
  const [customerSearch, setCustomerSearch] = useState('')
  const [salesOrders, setSalesOrders] = useState<{ id: string; order_number: string; customer_id: string }[]>([])
  const [products, setProducts] = useState<{ id: string; name: string; product_no: string; selling_price: number | null; standard_cost: number | null; client_id: string | null }[]>([])
  const [customerId, setCustomerId] = useState('')
  const [salesOrderId, setSalesOrderId] = useState('')
  const [deliveryType, setDeliveryType] = useState<typeof DELIVERY_TYPES[number]>('量産')
  const [deliveryDate, setDeliveryDate] = useState(new Date().toISOString().split('T')[0])
  const [items, setItems] = useState<DeliveryItem[]>([
    { sales_order_item_id: null, product_id: null, product_name: '', product_no: '', quantity: 1, unit_price: 0, amount: 0, unit_cost: 0, cost_amount: 0, cost_overridden: false, notes: '' }
  ])
  const [pdfLoading, setPdfLoading] = useState(false)
  const [saving, setSaving] = useState(false)
  const [message, setMessage] = useState<string | null>(null)
  const [loadingOrder, setLoadingOrder] = useState(false)

  useEffect(() => {
    supabase.from('customers').select('id, name').eq('type', 'customer').eq('is_active', true).order('name')
      .then(({ data }) => setCustomers(data || []))
    supabase.from('sales_orders').select('id, order_number, client_id').in('status', ['confirmed', 'in_production']).order('order_number', { ascending: false })
      .then(({ data }) => setSalesOrders((data || []).map(o => ({ id: o.id, order_number: o.order_number, customer_id: o.client_id }))))
    supabase.from('products').select('id, name, product_no, selling_price, standard_cost, client_id').eq('status', 'active').order('product_no')
      .then(({ data }) => setProducts(data || []))
  }, [supabase])

  async function handleLoadFromOrder(orderId: string) {
    setSalesOrderId(orderId)
    if (!orderId) return
    setLoadingOrder(true)
    try {
      const order = salesOrders.find(o => o.id === orderId)
      if (order?.customer_id) setCustomerId(order.customer_id)

      const { data: orderItems } = await supabase
        .from('sales_order_items')
        .select('*, products(name, product_no, standard_cost)')
        .eq('order_id', orderId)
        .order('sort_order')

      if (orderItems && orderItems.length > 0) {
        setItems(orderItems.map(item => {
          const product = item.products as { name: string; product_no: string; standard_cost: number } | null
          const remaining = item.quantity - (item.delivered_quantity || 0)
          const unitCost = product?.standard_cost || 0
          const qty = remaining > 0 ? remaining : item.quantity
          return {
            sales_order_item_id: item.id,
            product_id: item.product_id || null,
            product_name: product?.name || '',
            product_no: product?.product_no || '',
            quantity: qty,
            unit_price: item.unit_price || 0,
            amount: qty * (item.unit_price || 0),
            unit_cost: unitCost,
            cost_amount: qty * unitCost,
            cost_overridden: false,
            notes: item.notes || '',
          }
        }))
      }
    } finally { setLoadingOrder(false) }
  }

  function updateItem(idx: number, updates: Partial<DeliveryItem>) {
    setItems(prev => prev.map((item, i) => {
      if (i !== idx) return item
      const updated = { ...item, ...updates }
      if ('quantity' in updates || 'unit_price' in updates) {
        updated.amount = updated.quantity * updated.unit_price
      }
      if ('quantity' in updates || 'unit_cost' in updates) {
        updated.cost_amount = updated.quantity * updated.unit_cost
        if ('unit_cost' in updates) updated.cost_overridden = true
      }
      return updated
    }))
  }

  function addItem() {
    setItems(prev => [...prev, { sales_order_item_id: null, product_id: null, product_name: '', product_no: '', quantity: 1, unit_price: 0, amount: 0, unit_cost: 0, cost_amount: 0, cost_overridden: false, notes: '' }])
  }

  function removeItem(idx: number) {
    setItems(prev => prev.filter((_, i) => i !== idx))
  }

  const totalAmount = items.reduce((s, i) => s + i.amount, 0)
  const totalCost = items.reduce((s, i) => s + i.cost_amount, 0)
  const grossProfit = totalAmount - totalCost
  const grossMargin = totalAmount > 0 ? Math.round((grossProfit / totalAmount) * 100) : 0
  const tax = Math.round(totalAmount * 0.1)
  const totalWithTax = totalAmount + tax

  async function handleSaveAndPdf() {
    if (!customerId) { setMessage('得意先を選択してください'); return }
    if (!items.some(i => i.product_name.trim())) { setMessage('明細を1件以上入力してください'); return }
    setSaving(true)
    setMessage(null)
    try {
      const { data: { user } } = await supabase.auth.getUser()
      const deliveryNumber = `DN-${new Date().getFullYear()}-${String(Date.now()).slice(-6)}`
      const selectedOrder = salesOrders.find(o => o.id === salesOrderId)

      const { data: dn, error } = await supabase.from('delivery_notes').insert({
        delivery_number: deliveryNumber,
        sales_order_id: salesOrderId || null,
        customer_id: customerId || null,
        customer_name: customers.find(c => c.id === customerId)?.name || null,
        delivery_date: deliveryDate,
        delivery_type: deliveryType,
        created_by: user?.id,
      }).select().single()

      if (error) throw error

      const validItems = items.filter(i => i.product_name.trim())
      await supabase.from('delivery_note_items').insert(
        validItems.map((item, idx) => ({
          delivery_note_id: dn.id,
          sales_order_item_id: item.sales_order_item_id,
          product_name: item.product_name,
          product_no: item.product_no || null,
          quantity: item.quantity,
          unit_price: item.unit_price,
          amount: item.amount,
          unit_cost: item.unit_cost,
          cost_amount: item.cost_amount,
          cost_overridden: item.cost_overridden,
          notes: item.notes || null,
          sort_order: idx,
        }))
      )

      // 受注残数を更新
      if (salesOrderId) {
        for (const item of validItems) {
          if (item.sales_order_item_id) {
            const { data: orderItem } = await supabase
              .from('sales_order_items')
              .select('delivered_quantity')
              .eq('id', item.sales_order_item_id)
              .single()
            const newDelivered = (orderItem?.delivered_quantity || 0) + item.quantity
            await supabase.from('sales_order_items')
              .update({ delivered_quantity: newDelivered })
              .eq('id', item.sales_order_item_id)
          }
        }
      }

      // 製品在庫を減算
      for (const item of validItems) {
        if (item.product_no) {
          const { data: product } = await supabase
            .from('products')
            .select('id, current_stock')
            .eq('product_no', item.product_no)
            .single()
          if (product) {
            const newStock = Math.max(0, (product.current_stock || 0) - item.quantity)
            await supabase.from('products')
              .update({ current_stock: newStock, stock_updated_at: new Date().toISOString() })
              .eq('id', product.id)
            await supabase.from('product_stock_transactions').insert({
              product_id: product.id,
              transaction_type: 'sales_out',
              quantity: item.quantity,
              unit_cost: item.unit_cost || 0,
              amount: item.cost_amount || 0,
              reference_type: 'delivery_note',
              reference_id: dn.id,
              note: `納品書 ${deliveryNumber}`,
              transaction_date: deliveryDate,
              created_by: user?.id,
            })
          }
        }
      }

      setMessage('保存しました')
      await generatePdf(deliveryNumber, validItems, customerId)
    } catch (e) {
      console.error(e)
      const errMsg = e instanceof Error ? e.message : JSON.stringify(e)
      setMessage('失敗しました: ' + errMsg)
    } finally { setSaving(false) }
  }

  async function generatePdf(deliveryNumber: string, validItems: DeliveryItem[], custId: string) {
    setPdfLoading(true)
    try {
      const { data: customerData } = await supabase
        .from('customers').select('name, postal_code, address, contact_person, phone, fax')
        .eq('id', custId).single()
      const { data: company } = await supabase.from('company_info').select('*').single()

      const { pdf, Document, Page, Text, View, StyleSheet, Font } = await import('@react-pdf/renderer')
      Font.register({ family: 'NotoSans', src: '/NotoSans.otf' })

      const ROWS = 10
      const chunks: DeliveryItem[][] = []
      for (let i = 0; i < Math.max(1, Math.ceil(validItems.length / ROWS)); i++) {
        chunks.push(validItems.slice(i * ROWS, (i + 1) * ROWS))
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
                {customerData?.postal_code && <Text style={styles.customerSub}>〒{customerData.postal_code}</Text>}
                {customerData?.address && <Text style={styles.customerSub}>{customerData.address}</Text>}
                <Text style={styles.customerName}>{customerData?.name || ''}</Text>
                {customerData?.contact_person && <Text style={styles.customerSub}>{customerData.contact_person} 様</Text>}
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
            <Text style={styles.assignedRow}>担当：{'安田　明宏'}</Text>
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
    } finally { setPdfLoading(false) }
  }

  return (
    <div className="p-6 max-w-5xl mx-auto">
      <div className="mb-6">
        <h1 className="text-xl font-bold text-gray-900">納品書発行</h1>
        <p className="text-sm text-gray-500">受注Noから読み込むか、直接入力して納品書を発行できます</p>
      </div>

      <div className="bg-white border border-gray-200 rounded-2xl p-6">
        <div className="grid grid-cols-2 gap-4 mb-4">
          <div>
            <label className="text-xs font-medium text-gray-600 mb-1 block">受注Noから読み込む（任意）</label>
            <div className="flex gap-2">
              <select value={salesOrderId} onChange={e => handleLoadFromOrder(e.target.value)}
                className="flex-1 text-sm border border-gray-300 rounded-lg px-3 py-2 bg-white focus:outline-none focus:ring-2 focus:ring-blue-500">
                <option value="">受注Noを選択（任意）</option>
                {salesOrders.map(o => <option key={o.id} value={o.id}>{o.order_number}</option>)}
              </select>
              {loadingOrder && <Loader2 className="h-5 w-5 animate-spin text-blue-600 self-center" />}
            </div>
          </div>
          <div>
            <label className="text-xs font-medium text-gray-600 mb-1 block">得意先 *</label>
            <input type="text" value={customerSearch} onChange={e => setCustomerSearch(e.target.value)}
              placeholder="得意先名で検索..."
              className="w-full text-sm border border-gray-300 rounded-t-lg px-3 py-2 focus:outline-none focus:ring-2 focus:ring-blue-500" />
            <select value={customerId} onChange={e => setCustomerId(e.target.value)} size={4}
              className="w-full text-sm border border-gray-300 rounded-b-lg px-3 py-1 bg-white focus:outline-none focus:ring-2 focus:ring-blue-500">
              <option value="">選択してください</option>
              {customers.filter(c => {
                if (!customerSearch) return true
                const normalize = (s: string) => s.normalize('NFKC').toLowerCase()
                return normalize(c.name).includes(normalize(customerSearch))
              }).map(c => <option key={c.id} value={c.id}>{c.name}</option>)}
            </select>
          </div>
          <div>
            <label className="text-xs font-medium text-gray-600 mb-1 block">納品日 *</label>
            <input type="date" value={deliveryDate} onChange={e => setDeliveryDate(e.target.value)}
              className="w-full text-sm border border-gray-300 rounded-lg px-3 py-2 focus:outline-none focus:ring-2 focus:ring-blue-500" />
          </div>
          <div>
            <label className="text-xs font-medium text-gray-600 mb-1 block">区分 *</label>
            <select value={deliveryType} onChange={e => setDeliveryType(e.target.value as typeof DELIVERY_TYPES[number])}
              className="w-full text-sm border border-gray-300 rounded-lg px-3 py-2 bg-white focus:outline-none focus:ring-2 focus:ring-blue-500">
              {DELIVERY_TYPES.map(t => <option key={t} value={t}>{t}</option>)}
            </select>
          </div>
        </div>

        <div className="bg-white border border-gray-200 rounded-xl overflow-hidden mb-4">
          <div className="grid grid-cols-12 bg-gray-50 px-3 py-2 text-xs font-medium text-gray-500 border-b border-gray-200">
            <div className="col-span-3">商品名 *</div>
            <div className="col-span-1">品番</div>
            <div className="col-span-1 text-right">数量</div>
            <div className="col-span-1 text-right">単価</div>
            <div className="col-span-1 text-right">売上</div>
            <div className="col-span-1 text-right">原価</div>
            <div className="col-span-1 text-right">粗利/率</div>
            <div className="col-span-2 pl-2">備考</div>
            <div className="col-span-1"></div>
          </div>
          {items.map((item, idx) => {
            const profit = item.amount - item.cost_amount
            const margin = item.amount > 0 ? Math.round((profit / item.amount) * 100) : 0
            return (
              <div key={idx} className="grid grid-cols-12 px-3 py-2 border-b border-gray-100 items-center gap-1">
                <div className="col-span-3">
                  <SearchableSelect
                    value={item.product_id ?? ''}
                    onChange={(id, opt) => {
                      const prod = products.find(p => p.id === id)
                      updateItem(idx, {
                        product_id: id || null,
                        product_name: prod?.name ?? opt?.label ?? '',
                        product_no: prod?.product_no ?? '',
                        unit_price: prod?.selling_price ?? item.unit_price,
                        unit_cost: prod?.standard_cost ?? item.unit_cost,
                      })
                    }}
                    options={(customerId
                      ? products.filter(p => p.client_id === customerId || p.id === item.product_id)
                      : products
                    ).map(p => ({ id: p.id, label: p.name, sublabel: p.product_no }))}
                    placeholder="商品名で検索"
                    emptyText={customerId ? 'このクライアントに紐づく製品がありません' : '該当する製品がありません'}
                    className="w-full text-xs border border-gray-200 rounded px-2 py-1.5 focus:outline-none focus:ring-1 focus:ring-blue-500"
                  />
                  <input type="text" value={item.product_no} onChange={e => updateItem(idx, { product_no: e.target.value })}
                    placeholder="品番" className="w-full text-xs border border-gray-200 rounded px-2 py-1 mt-0.5 text-gray-400 focus:outline-none focus:ring-1 focus:ring-blue-500" />
                </div>
                <div className="col-span-1 text-xs text-gray-400 text-center">{item.product_no ? '' : ''}</div>
                <div className="col-span-1">
                  <input type="number" value={item.quantity} min={0} onChange={e => updateItem(idx, { quantity: Number(e.target.value) })}
                    className="w-full text-xs text-right border border-gray-200 rounded px-2 py-1.5 focus:outline-none focus:ring-1 focus:ring-blue-500" />
                </div>
                <div className="col-span-1">
                  <input type="number" value={item.unit_price} min={0} onChange={e => updateItem(idx, { unit_price: Number(e.target.value) })}
                    className="w-full text-xs text-right border border-gray-200 rounded px-2 py-1.5 focus:outline-none focus:ring-1 focus:ring-blue-500" />
                </div>
                <div className="col-span-1 text-xs text-right font-medium">¥{item.amount.toLocaleString()}</div>
                <div className="col-span-1">
                  <input type="number" value={item.unit_cost} min={0} onChange={e => updateItem(idx, { unit_cost: Number(e.target.value) })}
                    className={`w-full text-xs text-right border rounded px-2 py-1.5 focus:outline-none focus:ring-1 focus:ring-blue-500 ${item.cost_overridden ? 'border-orange-300 bg-orange-50' : 'border-gray-200'}`} />
                </div>
                <div className="col-span-1 text-xs text-right">
                  <p className={`font-medium ${profit >= 0 ? 'text-green-600' : 'text-red-600'}`}>¥{profit.toLocaleString()}</p>
                  <p className="text-gray-400">{margin}%</p>
                </div>
                <div className="col-span-2">
                  <input type="text" value={item.notes} onChange={e => updateItem(idx, { notes: e.target.value })}
                    placeholder="備考" className="w-full text-xs border border-gray-200 rounded px-2 py-1.5 focus:outline-none focus:ring-1 focus:ring-blue-500" />
                </div>
                <div className="col-span-1 flex justify-center">
                  {items.length > 1 && (
                    <button onClick={() => removeItem(idx)} className="text-gray-300 hover:text-red-500">
                      <Trash2 className="h-3.5 w-3.5" />
                    </button>
                  )}
                </div>
              </div>
            )
          })}
        </div>

        <button onClick={addItem} className="flex items-center gap-1 text-xs text-blue-600 hover:underline mb-4">
          <Plus className="h-3.5 w-3.5" />行を追加
        </button>

        <div className="bg-gray-50 rounded-xl p-4 mb-4">
          <div className="grid grid-cols-4 gap-4 text-center">
            <div><p className="text-xs text-gray-500 mb-1">売上（税抜）</p><p className="text-lg font-bold text-gray-900">¥{totalAmount.toLocaleString()}</p></div>
            <div><p className="text-xs text-gray-500 mb-1">原価</p><p className="text-lg font-bold text-gray-600">¥{totalCost.toLocaleString()}</p></div>
            <div><p className="text-xs text-gray-500 mb-1">粗利</p><p className={`text-lg font-bold ${grossProfit >= 0 ? 'text-green-600' : 'text-red-600'}`}>¥{grossProfit.toLocaleString()}</p></div>
            <div><p className="text-xs text-gray-500 mb-1">粗利率</p><p className={`text-lg font-bold ${grossMargin >= 30 ? 'text-green-600' : 'text-orange-500'}`}>{grossMargin}%</p></div>
          </div>
        </div>

        <div className="flex items-center justify-between">
          <p className="text-sm text-gray-600">合計（税込）: <span className="font-bold text-blue-700">¥{totalWithTax.toLocaleString()}</span></p>
          <div className="flex items-center gap-2">
            {message && <span className={`text-xs ${message.includes('失敗') || message.includes('選択') || message.includes('入力') ? 'text-red-600' : 'text-green-600'}`}>{message}</span>}
            <button onClick={handleSaveAndPdf} disabled={saving || pdfLoading}
              className="flex items-center gap-2 bg-green-700 text-white text-sm font-medium px-4 py-2 rounded-lg hover:bg-green-800 disabled:opacity-50">
              {saving || pdfLoading ? <Loader2 className="h-4 w-4 animate-spin" /> : <FileDown className="h-4 w-4" />}
              {saving ? '保存中...' : pdfLoading ? 'PDF生成中...' : '保存してPDF出力'}
            </button>
          </div>
        </div>
      </div>
    </div>
  )
}
