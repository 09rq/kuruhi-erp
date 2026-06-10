import {
  Document, Page, Text, View, StyleSheet, Font,
} from '@react-pdf/renderer'
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

// 日本語フォント（ローカル）
// サーバー側: 絶対パス（file://なし）→ fontkit.open() でFSから直接読む
// ブラウザ側: /fonts/ 相対URL
const FONT_BASE =
  typeof window === 'undefined'
    ? process.env.NEXT_PUBLIC_SITE_URL
      ? `${process.env.NEXT_PUBLIC_SITE_URL}/fonts`
      : `${process.cwd()}/public/fonts`
    : '/fonts'

Font.register({
  family: 'NotoSansJP',
  fonts: [
    { src: `${FONT_BASE}/NotoSansJP-Regular.ttf`, fontWeight: 400 },
    { src: `${FONT_BASE}/NotoSansJP-Bold.ttf`,    fontWeight: 700 },
  ],
})

const NAVY  = '#1F3864'
const GRAY  = '#6b7280'
const LIGHT = '#f3f4f6'
const LINE  = '#d1d5db'

const s = StyleSheet.create({
  // ── ページ（横向き A4）──────────────────────────────────────
  page: {
    fontFamily: 'NotoSansJP',
    fontSize: 9,
    paddingTop: 24,
    paddingBottom: 24,
    paddingLeft: 32,
    paddingRight: 32,
    color: '#111827',
    flexDirection: 'column',
  },

  // ── タイトル ────────────────────────────────────────────────
  title: {
    fontSize: 18,
    fontWeight: 700,
    color: NAVY,
    textAlign: 'center',
    letterSpacing: 6,
    marginBottom: 10,
  },

  // ── ヘッダー 3 カラム ─────────────────────────────────────
  headerRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    marginBottom: 8,
  },

  // 左：発注先ブロック
  supplierCol: { width: '38%' },
  supplierName: {
    fontSize: 14,
    fontWeight: 700,
    borderBottomWidth: 1.5,
    borderBottomColor: NAVY,
    borderBottomStyle: 'solid',
    paddingBottom: 3,
    marginBottom: 5,
  },
  supplierLine: { fontSize: 8.5, marginBottom: 2 },

  staffRow: { flexDirection: 'row', alignItems: 'baseline' },
  staffLabel: { fontSize: 8, color: GRAY, marginRight: 3 },
  staffValue: { fontSize: 9, fontWeight: 700 },

  // 右：自社情報 + 文書メタ
  rightCol: { width: '38%', alignItems: 'flex-end' },
  companyName: { fontSize: 11, fontWeight: 700, color: NAVY, marginBottom: 2 },
  companyLine: { fontSize: 8, color: GRAY, marginBottom: 1 },
  metaDivider: {
    width: '100%',
    borderTopWidth: 0.5,
    borderTopColor: LINE,
    borderTopStyle: 'solid',
    marginTop: 5,
    marginBottom: 5,
  },
  metaLine: { flexDirection: 'row', marginBottom: 3 },
  metaLabel: { fontSize: 8, color: GRAY, width: 44, textAlign: 'right', marginRight: 4 },
  metaValue: { fontSize: 8.5, fontWeight: 700 },

  // ── 御注文金額 / 希望納期 ─────────────────────────────────
  amountRow: {
    flexDirection: 'row',
    borderTopWidth: 1.5,
    borderTopColor: NAVY,
    borderTopStyle: 'solid',
    borderBottomWidth: 1.5,
    borderBottomColor: NAVY,
    borderBottomStyle: 'solid',
    paddingTop: 6,
    paddingBottom: 6,
    paddingLeft: 8,
    paddingRight: 8,
    marginBottom: 8,
    alignItems: 'center',
  },
  amountBlock: { flex: 1 },
  amountLabel: { fontSize: 8, color: GRAY, marginBottom: 2 },
  amountValue: { fontSize: 22, fontWeight: 700, color: NAVY },
  deliveryBlock: { flex: 1, alignItems: 'flex-end' },
  deliveryLabel: { fontSize: 8, color: GRAY, marginBottom: 2 },
  deliveryValue: { fontSize: 16, fontWeight: 700, color: NAVY },

  // ── 明細テーブル ──────────────────────────────────────────
  table: { marginBottom: 8 },
  thead: {
    flexDirection: 'row',
    backgroundColor: NAVY,
    paddingTop: 4,
    paddingBottom: 4,
    paddingLeft: 4,
    paddingRight: 4,
  },
  th: { color: '#fff', fontSize: 7.5, fontWeight: 700 },
  tr: {
    flexDirection: 'row',
    paddingTop: 3,
    paddingBottom: 3,
    paddingLeft: 4,
    paddingRight: 4,
    borderBottomWidth: 0.5,
    borderBottomColor: '#e5e7eb',
    borderBottomStyle: 'solid',
  },
  trAlt: {
    flexDirection: 'row',
    paddingTop: 3,
    paddingBottom: 3,
    paddingLeft: 4,
    paddingRight: 4,
    borderBottomWidth: 0.5,
    borderBottomColor: '#e5e7eb',
    borderBottomStyle: 'solid',
    backgroundColor: LIGHT,
  },
  td: { fontSize: 8 },

  // ── 備考 ─────────────────────────────────────────────────
  noteBox: {
    borderWidth: 0.5,
    borderColor: LINE,
    borderStyle: 'solid',
    borderRadius: 2,
    padding: 6,
    minHeight: 44,
  },
  noteLabel: { fontSize: 8, color: GRAY, marginBottom: 3 },
  noteText:  { fontSize: 8.5 },
})

function fmtDate(d: string | null | undefined) {
  if (!d) return '—'
  const dt = new Date(d)
  return `${dt.getFullYear()}年${dt.getMonth() + 1}月${dt.getDate()}日`
}

function fmtNum(n: number) {
  return n.toLocaleString('ja-JP')
}

// カラム幅定義（横 A4 の余裕を生かした配分）
const COL = {
  name:     '30%',
  model:    '14%',
  color:    '7%',
  qty:      '6%',
  unit:     '5%',
  price:    '11%',
  amount:   '12%',
  delivery: '13%',
}

export default function PurchaseOrderPDFDoc({ order, company, employeeName }: Props) {
  return (
    <Document>
      <Page size="A4" orientation="landscape" style={s.page}>

        {/* ─── タイトル ─── */}
        <Text style={s.title}>御　注　文　書</Text>

        {/* ─── ヘッダー3カラム ─── */}
        <View style={s.headerRow}>

          {/* 左：発注先 */}
          <View style={s.supplierCol}>
            <Text style={s.supplierName}>{order.supplier_name}　御中</Text>
            {order.supplier_phone && (
              <Text style={s.supplierLine}>TEL: {order.supplier_phone}</Text>
            )}
            {order.supplier_fax && (
              <Text style={s.supplierLine}>FAX: {order.supplier_fax}</Text>
            )}
            {order.supplier_contact && (
              <Text style={s.supplierLine}>担当: {order.supplier_contact} 様</Text>
            )}
          </View>

          {/* 右：文書メタ → 自社情報 → 担当者 */}
          <View style={s.rightCol}>
            {/* PAGE / 発注日 / 発注NO */}
            <View style={s.metaLine}>
              <Text style={s.metaLabel}>PAGE</Text>
              <Text style={s.metaValue}>1 / 1</Text>
            </View>
            <View style={s.metaLine}>
              <Text style={s.metaLabel}>発注日</Text>
              <Text style={s.metaValue}>{fmtDate(order.order_date)}</Text>
            </View>
            <View style={s.metaLine}>
              <Text style={s.metaLabel}>発注NO</Text>
              <Text style={s.metaValue}>{order.po_number}</Text>
            </View>

            {/* 区切り線 */}
            <View style={s.metaDivider} />

            {/* 自社情報 */}
            <Text style={s.companyName}>{company.name}</Text>
            {company.address && (
              <Text style={s.companyLine}>{company.address}</Text>
            )}
            {(company.phone || company.fax) && (
              <Text style={s.companyLine}>
                {company.phone ? `TEL: ${company.phone}` : ''}
                {company.phone && company.fax ? '　' : ''}
                {company.fax ? `FAX: ${company.fax}` : ''}
              </Text>
            )}
            {company.invoice_number && (
              <Text style={s.companyLine}>登録番号: {company.invoice_number}</Text>
            )}

            {/* 担当者（登録番号の下） */}
            {employeeName && (
              <View style={[s.staffRow, { marginTop: 4 }]}>
                <Text style={s.staffLabel}>担当者：</Text>
                <Text style={s.staffValue}>{employeeName}</Text>
              </View>
            )}
          </View>
        </View>

        {/* ─── 御注文金額 / 希望納期 ─── */}
        <View style={s.amountRow}>
          <View style={s.amountBlock}>
            <Text style={s.amountLabel}>御注文金額（税抜）</Text>
            <Text style={s.amountValue}>¥ {fmtNum(order.subtotal)}</Text>
          </View>
          <View style={s.deliveryBlock}>
            <Text style={s.deliveryLabel}>希望納期</Text>
            <Text style={s.deliveryValue}>
              {order.desired_delivery_date ? fmtDate(order.desired_delivery_date) : '—'}
            </Text>
          </View>
        </View>

        {/* ─── 明細テーブル ─── */}
        <View style={s.table}>
          <View style={s.thead}>
            <Text style={[s.th, { width: COL.name }]}>シリーズ / 商品名</Text>
            <Text style={[s.th, { width: COL.model }]}>型名</Text>
            <Text style={[s.th, { width: COL.color }]}>色</Text>
            <Text style={[s.th, { width: COL.qty, textAlign: 'right' }]}>数量</Text>
            <Text style={[s.th, { width: COL.unit, textAlign: 'center' }]}>単位</Text>
            <Text style={[s.th, { width: COL.price, textAlign: 'right' }]}>単価</Text>
            <Text style={[s.th, { width: COL.amount, textAlign: 'right' }]}>金額</Text>
            <Text style={[s.th, { width: COL.delivery }]}>納期</Text>
          </View>

          {order.items.map((item, i) => (
            <View key={item.id} style={i % 2 === 0 ? s.tr : s.trAlt}>
              <Text style={[s.td, { width: COL.name }]}>{item.item_name}</Text>
              <Text style={[s.td, { width: COL.model }]}>{item.model_name ?? ''}</Text>
              <Text style={[s.td, { width: COL.color }]}>{item.color ?? ''}</Text>
              <Text style={[s.td, { width: COL.qty, textAlign: 'right' }]}>{fmtNum(item.quantity)}</Text>
              <Text style={[s.td, { width: COL.unit, textAlign: 'center' }]}>{item.unit ?? ''}</Text>
              <Text style={[s.td, { width: COL.price, textAlign: 'right' }]}>¥{fmtNum(item.unit_price)}</Text>
              <Text style={[s.td, { width: COL.amount, textAlign: 'right' }]}>¥{fmtNum(item.amount)}</Text>
              <Text style={[s.td, { width: COL.delivery }]}>{fmtDate(item.delivery_date)}</Text>
            </View>
          ))}
        </View>

        {/* スペーサー：備考をページ最下部へ押し下げ */}
        <View style={{ flex: 1 }} />

        {/* ─── 備考 ─── */}
        <View style={s.noteBox}>
          <Text style={s.noteLabel}>備考</Text>
          {order.note
            ? <Text style={s.noteText}>{order.note}</Text>
            : null
          }
        </View>

      </Page>
    </Document>
  )
}
