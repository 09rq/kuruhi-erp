import {
  Document, Page, Text, View, StyleSheet, Font,
} from '@react-pdf/renderer'

interface EstimateItem {
  id: string
  sort_order: number
  item_name: string
  quantity: number | null
  unit: string | null
  unit_price: number | null
  amount: number
  notes: string | null
}

interface CompanyInfo {
  name: string
  postal_code: string | null
  address: string | null
  phone: string | null
  fax: string | null
}

interface EstimateData {
  estimate_number: string
  client_name: string | null
  client_contact: string | null
  issue_date: string
  expiry_date: string | null
  subject: string | null
  delivery_date: string | null
  total_amount: number | null
  tax_amount: number | null
  grand_total: number | null
  payment_terms: string | null
  notes: string | null
  items: EstimateItem[]
}

interface Props {
  estimate: EstimateData
  company: CompanyInfo
}

// 日本語フォント
// @react-pdf/font は is-url で file:// を URL と判定し fetch() を呼ぶが、
// Node.js の fetch は file:// 非対応（"not implemented...yet"）。
// file:// を外した絶対パスは isUrl()=false → fontkit.open() でFSから直接読む。
// ブラウザ側（usePDF）は /fonts/ の相対パスを使う。
const FONT_BASE =
  typeof window === 'undefined'
    ? `${process.cwd()}/public/fonts`  // サーバー側: FSから直接読む
    : '/api/fonts'                      // クライアント側: APIルート

Font.register({
  family: 'NotoSansJP',
  fonts: [
    { src: `${FONT_BASE}/NotoSansJP-Regular.ttf`, fontWeight: 400 },
    { src: `${FONT_BASE}/NotoSansJP-Bold.ttf`,    fontWeight: 700 },
  ],
})

const NAVY = '#1F3864'
const GRAY = '#6b7280'
const LINE = '#d1d5db'
const LIGHT = '#f3f4f6'

const s = StyleSheet.create({
  page: {
    fontFamily: 'NotoSansJP',
    fontSize: 9,
    paddingTop: 28,
    paddingBottom: 28,
    paddingLeft: 36,
    paddingRight: 36,
    color: '#111827',
    flexDirection: 'column',
  },

  // タイトル
  title: {
    fontSize: 18,
    fontWeight: 700,
    color: NAVY,
    textAlign: 'center',
    letterSpacing: 6,
    marginBottom: 12,
  },

  divider: {
    borderTopWidth: 1.5,
    borderTopColor: NAVY,
    borderTopStyle: 'solid',
    marginBottom: 10,
  },
  dividerThin: {
    borderTopWidth: 0.5,
    borderTopColor: LINE,
    borderTopStyle: 'solid',
    marginBottom: 8,
  },

  // ヘッダー行（クライアント左・自社右）
  headerRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    marginBottom: 10,
  },
  clientCol: { width: '45%' },
  clientName: {
    fontSize: 13,
    fontWeight: 700,
    borderBottomWidth: 1.5,
    borderBottomColor: NAVY,
    borderBottomStyle: 'solid',
    paddingBottom: 3,
    marginBottom: 4,
  },
  clientLine: { fontSize: 8.5, color: GRAY, marginBottom: 2 },

  metaCol: { width: '42%', alignItems: 'flex-end' },
  metaLine: { flexDirection: 'row', marginBottom: 2 },
  metaLabel: { fontSize: 8, color: GRAY, width: 52, textAlign: 'right', marginRight: 4 },
  metaValue: { fontSize: 8.5, fontWeight: 700 },

  metaDivider: {
    width: '100%',
    borderTopWidth: 0.5,
    borderTopColor: LINE,
    borderTopStyle: 'solid',
    marginTop: 5,
    marginBottom: 5,
  },
  companyName: { fontSize: 10, fontWeight: 700, color: NAVY, marginBottom: 2 },
  companyLine: { fontSize: 7.5, color: GRAY, marginBottom: 1 },

  // 挨拶文
  greeting: { fontSize: 8.5, color: GRAY, marginBottom: 8 },

  // 件名・納期・金額ブロック
  summaryBox: {
    borderWidth: 1,
    borderColor: LINE,
    borderStyle: 'solid',
    borderRadius: 3,
    padding: 8,
    marginBottom: 12,
  },
  summaryRow: { flexDirection: 'row', alignItems: 'center', marginBottom: 4 },
  summaryLabel: { fontSize: 8, color: GRAY, width: 60 },
  summaryValue: { fontSize: 9, fontWeight: 700, flex: 1 },
  grandTotalLabel: { fontSize: 8, color: GRAY, width: 60 },
  grandTotalValue: { fontSize: 14, fontWeight: 700, color: NAVY, flex: 1 },

  // 明細テーブル
  table: { marginBottom: 6 },
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

  // 合計行
  totalSection: { alignItems: 'flex-end', marginBottom: 10 },
  totalRow: { flexDirection: 'row', marginBottom: 2 },
  totalLabel: { fontSize: 8, color: GRAY, width: 72, textAlign: 'right', marginRight: 6 },
  totalValue: { fontSize: 8.5, fontWeight: 700, width: 70, textAlign: 'right' },
  grandRow: { flexDirection: 'row', marginTop: 3 },
  grandLabel: { fontSize: 9, fontWeight: 700, width: 72, textAlign: 'right', marginRight: 6 },
  grandValue: { fontSize: 12, fontWeight: 700, color: NAVY, width: 70, textAlign: 'right' },

  // 支払条件・備考
  footerSection: { marginTop: 8 },
  footerLabel: { fontSize: 8, fontWeight: 700, marginBottom: 2 },
  footerText: { fontSize: 8, color: GRAY },
})

const COL = {
  name:      '42%',
  qty:       '8%',
  unit:      '7%',
  unitPrice: '15%',
  amount:    '15%',
  notes:     '13%',
}

function fmtDate(d: string | null | undefined) {
  if (!d) return '—'
  const dt = new Date(d)
  return `${dt.getFullYear()}/${String(dt.getMonth() + 1).padStart(2,'0')}/${String(dt.getDate()).padStart(2,'0')}`
}

function fmtNum(n: number) {
  return `¥${Math.round(n).toLocaleString('ja-JP')}`
}

export default function EstimatePDFDoc({ estimate, company }: Props) {
  return (
    <Document>
      <Page size="A4" orientation="portrait" style={s.page}>

        {/* タイトル */}
        <Text style={s.title}>御　見　積　書</Text>
        <View style={s.divider} />

        {/* ヘッダー：クライアント（左）・自社情報（右） */}
        <View style={s.headerRow}>
          {/* 左：クライアント */}
          <View style={s.clientCol}>
            <Text style={s.clientName}>{estimate.client_name ?? '　'}　御中</Text>
            {estimate.client_contact && (
              <Text style={s.clientLine}>{estimate.client_contact}　様</Text>
            )}
          </View>

          {/* 右：見積メタ + 自社情報 */}
          <View style={s.metaCol}>
            <View style={s.metaLine}>
              <Text style={s.metaLabel}>見積番号</Text>
              <Text style={s.metaValue}>{estimate.estimate_number}</Text>
            </View>
            <View style={s.metaLine}>
              <Text style={s.metaLabel}>発行日</Text>
              <Text style={s.metaValue}>{fmtDate(estimate.issue_date)}</Text>
            </View>
            {estimate.expiry_date && (
              <View style={s.metaLine}>
                <Text style={s.metaLabel}>有効期限</Text>
                <Text style={s.metaValue}>{fmtDate(estimate.expiry_date)}</Text>
              </View>
            )}
            <View style={s.metaDivider} />
            <Text style={s.companyName}>{company.name}</Text>
            {(company.postal_code || company.address) && (
              <Text style={s.companyLine}>
                {company.postal_code ? `〒${company.postal_code}　` : ''}{company.address ?? ''}
              </Text>
            )}
            {company.phone && (
              <Text style={s.companyLine}>TEL：{company.phone}</Text>
            )}
            {company.fax && (
              <Text style={s.companyLine}>FAX：{company.fax}</Text>
            )}
          </View>
        </View>

        {/* 挨拶文 */}
        <Text style={s.greeting}>
          下記の通り御見積申し上げます。ご検討の程、よろしくお願い申し上げます。
        </Text>

        {/* 件名・納入期日・御見積金額 */}
        <View style={s.summaryBox}>
          {estimate.subject && (
            <View style={s.summaryRow}>
              <Text style={s.summaryLabel}>件名</Text>
              <Text style={s.summaryValue}>{estimate.subject}</Text>
            </View>
          )}
          {estimate.delivery_date && (
            <View style={s.summaryRow}>
              <Text style={s.summaryLabel}>納入期日</Text>
              <Text style={s.summaryValue}>{fmtDate(estimate.delivery_date)}</Text>
            </View>
          )}
          <View style={[s.summaryRow, { marginBottom: 0 }]}>
            <Text style={s.grandTotalLabel}>御見積金額</Text>
            <Text style={s.grandTotalValue}>
              {estimate.grand_total != null ? fmtNum(estimate.grand_total) : '—'}（税込）
            </Text>
          </View>
        </View>

        {/* 明細テーブル */}
        <View style={s.table}>
          <View style={s.thead}>
            <Text style={[s.th, { width: COL.name }]}>品名</Text>
            <Text style={[s.th, { width: COL.qty, textAlign: 'right' }]}>数量</Text>
            <Text style={[s.th, { width: COL.unit, textAlign: 'center' }]}>単位</Text>
            <Text style={[s.th, { width: COL.unitPrice, textAlign: 'right' }]}>単価</Text>
            <Text style={[s.th, { width: COL.amount, textAlign: 'right' }]}>金額</Text>
            <Text style={[s.th, { width: COL.notes }]}>備考</Text>
          </View>
          {estimate.items.map((item, i) => (
            <View key={item.id} style={i % 2 === 0 ? s.tr : s.trAlt}>
              <Text style={[s.td, { width: COL.name }]}>{item.item_name}</Text>
              <Text style={[s.td, { width: COL.qty, textAlign: 'right' }]}>
                {item.quantity?.toLocaleString('ja-JP') ?? ''}
              </Text>
              <Text style={[s.td, { width: COL.unit, textAlign: 'center' }]}>{item.unit ?? ''}</Text>
              <Text style={[s.td, { width: COL.unitPrice, textAlign: 'right' }]}>
                {item.unit_price != null ? fmtNum(item.unit_price) : ''}
              </Text>
              <Text style={[s.td, { width: COL.amount, textAlign: 'right' }]}>{fmtNum(item.amount)}</Text>
              <Text style={[s.td, { width: COL.notes }]}>{item.notes ?? ''}</Text>
            </View>
          ))}
        </View>

        {/* 合計 */}
        <View style={s.totalSection}>
          <View style={s.totalRow}>
            <Text style={s.totalLabel}>小計</Text>
            <Text style={s.totalValue}>{estimate.total_amount != null ? fmtNum(estimate.total_amount) : '—'}</Text>
          </View>
          <View style={s.totalRow}>
            <Text style={s.totalLabel}>消費税（10%）</Text>
            <Text style={s.totalValue}>{estimate.tax_amount != null ? fmtNum(estimate.tax_amount) : '—'}</Text>
          </View>
          <View style={s.grandRow}>
            <Text style={s.grandLabel}>合計金額</Text>
            <Text style={s.grandValue}>{estimate.grand_total != null ? fmtNum(estimate.grand_total) : '—'}</Text>
          </View>
        </View>

        <View style={s.dividerThin} />

        {/* スペーサー */}
        <View style={{ flex: 1 }} />

        {/* 支払条件・備考 */}
        <View style={s.footerSection}>
          {estimate.payment_terms && (
            <View style={{ marginBottom: 6 }}>
              <Text style={s.footerLabel}>【支払条件】</Text>
              <Text style={s.footerText}>{estimate.payment_terms}</Text>
            </View>
          )}
          {estimate.notes && (
            <View>
              <Text style={s.footerLabel}>【備考】</Text>
              <Text style={s.footerText}>{estimate.notes}</Text>
            </View>
          )}
        </View>
        <View style={s.dividerThin} />

      </Page>
    </Document>
  )
}
