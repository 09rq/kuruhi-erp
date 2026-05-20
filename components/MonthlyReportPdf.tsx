'use client'

import { useState } from 'react'
import { FileDown, Loader2, ChevronDown } from 'lucide-react'

interface BudgetActual {
  account_name: string
  balance: number
  ratio: number
}

interface Props {
  yearMonth: string
  revenue: number
  grossProfit: number
  grossMargin: string
  mfgCost: number
  materialRate: string
  outsourceRate: string
  laborRate: string
  freightRate: string
  materialCost: number
  outsourceCost: number
  laborCost: number
  freightCost: number
  plData: BudgetActual[]
  mfgData: BudgetActual[]
  aiSummary: string
  userRole: string
}

type ReportType = 'mfg' | 'full'

export default function MonthlyReportPdf(props: Props) {
  const [loading, setLoading] = useState(false)
  const [reportType, setReportType] = useState<ReportType>('mfg')
  const [showMenu, setShowMenu] = useState(false)
  const [aiLoading, setAiLoading] = useState(false)

  const canViewFull = ['admin', 'accounting'].includes(props.userRole)

  async function generateAiSummary(type: ReportType): Promise<string> {
    setAiLoading(true)
    try {
      const prompt = type === 'mfg'
        ? '製造原価に特化した分析'
        : '損益全体・販管費・製造原価を含む全社経営分析'
      const res = await fetch('/api/ai-summary', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          yearMonth: props.yearMonth,
          plData: props.plData,
          mfgData: props.mfgData,
          analysisType: prompt,
        }),
      })
      const data = await res.json()
      return data.summary || ''
    } catch { return '' } finally { setAiLoading(false) }
  }

  async function handleDownload(type: ReportType) {
    setLoading(true)
    setShowMenu(false)
    try {
      const aiSummary = await generateAiSummary(type)
      const { pdf, Document, Page, Text, View, StyleSheet, Font } = await import('@react-pdf/renderer')

      Font.register({ family: 'NotoSans', src: '/NotoSans.otf' })

      const styles = StyleSheet.create({
        page: { padding: 40, fontSize: 10, fontFamily: 'NotoSans' },
        title: { fontSize: 16, fontWeight: 'bold', marginBottom: 4, textAlign: 'center' },
        subtitle: { fontSize: 10, color: '#666', marginBottom: 20, textAlign: 'center' },
        reportBadge: { fontSize: 9, textAlign: 'center', marginBottom: 16, color: '#7c3aed' },
        section: { marginBottom: 16 },
        sectionTitle: { fontSize: 11, fontWeight: 'bold', marginBottom: 8, padding: 6, backgroundColor: '#1e3a5f', color: 'white' },
        row: { flexDirection: 'row', borderBottomWidth: 1, borderBottomColor: '#e5e7eb', paddingVertical: 4, paddingHorizontal: 4 },
        headerRow: { flexDirection: 'row', backgroundColor: '#f3f4f6', paddingVertical: 4, paddingHorizontal: 4 },
        col1: { flex: 3 },
        col2: { flex: 2, textAlign: 'right' },
        col3: { flex: 1, textAlign: 'right' },
        summaryGrid: { flexDirection: 'row', gap: 6, marginBottom: 8 },
        summaryCard: { flex: 1, padding: 8, backgroundColor: '#f0f4ff', borderRadius: 4 },
        summaryLabel: { fontSize: 8, color: '#666', marginBottom: 2 },
        summaryValue: { fontSize: 13, fontWeight: 'bold', color: '#1e3a5f' },
        kpiRow: { flexDirection: 'row', marginBottom: 6, paddingHorizontal: 4 },
        kpiLabel: { flex: 2 },
        kpiResult: { flex: 3, textAlign: 'center' },
        kpiAmount: { flex: 2, textAlign: 'right' },
        good: { color: '#16a34a' },
        bad: { color: '#dc2626' },
        aiBox: { backgroundColor: '#faf5ff', padding: 10, borderRadius: 4, borderLeftWidth: 3, borderLeftColor: '#7c3aed' },
        aiText: { fontSize: 9, lineHeight: 1.6, color: '#374151' },
        footer: { position: 'absolute', bottom: 20, left: 40, right: 40, textAlign: 'center', fontSize: 8, color: '#9ca3af' },
        confidential: { position: 'absolute', bottom: 30, left: 40, right: 40, textAlign: 'center', fontSize: 9, color: '#dc2626' },
      })

      const EXCLUDE_SGA = ['販売管理費 計', '営業外費用', '営業外収益', '営業損益金額', '経常損益金額', '税引前当期純損益金額', '当期純損益金額', '支払利息', '受取利息', '雑収入', '受取配当金', '売上高', '売上戻り高', '売上高 計', '売上原価', '売上総損益金額']
      const sgaItems = props.plData.filter(a => !EXCLUDE_SGA.includes(a.account_name) && a.balance > 0 && a.ratio > 0.1).sort((a, b) => b.balance - a.balance).slice(0, 12)
      const mfgItems = props.mfgData.filter(a => a.balance > 0).sort((a, b) => b.balance - a.balance).slice(0, 15)

      const MfgReport = () => (
        <Document>
          <Page size="A4" style={styles.page}>
            <Text style={styles.title}>製造原価レポート</Text>
            <Text style={styles.subtitle}>株式会社クルヒ　{props.yearMonth}　作成日: {new Date().toLocaleDateString('ja-JP')}</Text>

            <View style={styles.section}>
              <Text style={styles.sectionTitle}>1. 製造原価サマリー</Text>
              <View style={styles.summaryGrid}>
                <View style={styles.summaryCard}>
                  <Text style={styles.summaryLabel}>製造原価合計</Text>
                  <Text style={styles.summaryValue}>{(props.mfgCost / 1000000).toFixed(1)}百万円</Text>
                </View>
                <View style={styles.summaryCard}>
                  <Text style={styles.summaryLabel}>材料費率</Text>
                  <Text style={styles.summaryValue}>{props.materialRate}%</Text>
                </View>
                <View style={styles.summaryCard}>
                  <Text style={styles.summaryLabel}>外注加工費率</Text>
                  <Text style={styles.summaryValue}>{props.outsourceRate}%</Text>
                </View>
                <View style={styles.summaryCard}>
                  <Text style={styles.summaryLabel}>労務費率</Text>
                  <Text style={styles.summaryValue}>{props.laborRate}%</Text>
                </View>
              </View>
            </View>

            <View style={styles.section}>
              <Text style={styles.sectionTitle}>2. 原価率 KPI目標との比較</Text>
              <View style={styles.headerRow}>
                <Text style={styles.kpiLabel}>項目</Text>
                <Text style={styles.kpiResult}>実績 / 目標 / 判定</Text>
                <Text style={styles.kpiAmount}>金額（円）</Text>
              </View>
              {[
                { label: '材料費率', actual: props.materialRate, target: 18.5, amount: props.materialCost },
                { label: '外注加工費率', actual: props.outsourceRate, target: 43.5, amount: props.outsourceCost },
                { label: '労務費率', actual: props.laborRate, target: 7.0, amount: props.laborCost },
                { label: '荷造運賃率', actual: props.freightRate, target: 1.0, amount: props.freightCost },
              ].map(({ label, actual, target, amount }) => {
                const isGood = Number(actual) <= target
                return (
                  <View key={label} style={styles.kpiRow}>
                    <Text style={styles.kpiLabel}>{label}</Text>
                    <Text style={[styles.kpiResult, isGood ? styles.good : styles.bad]}>
                      {actual}% / {target}% / {isGood ? '目標内' : `${(Number(actual) - target).toFixed(1)}%超過`}
                    </Text>
                    <Text style={styles.kpiAmount}>{Number(amount).toLocaleString()}</Text>
                  </View>
                )
              })}
            </View>

            <View style={styles.section}>
              <Text style={styles.sectionTitle}>3. 製造原価 明細</Text>
              <View style={styles.headerRow}>
                <Text style={styles.col1}>勘定科目</Text>
                <Text style={styles.col2}>金額（円）</Text>
                <Text style={styles.col3}>構成比</Text>
              </View>
              {mfgItems.map(item => (
                <View key={item.account_name} style={styles.row}>
                  <Text style={styles.col1}>{item.account_name}</Text>
                  <Text style={styles.col2}>{Number(item.balance).toLocaleString()}</Text>
                  <Text style={styles.col3}>{item.ratio}%</Text>
                </View>
              ))}
            </View>

            {aiSummary && (
              <View style={styles.section}>
                <Text style={styles.sectionTitle}>4. AI総評（製造原価分析）</Text>
                <View style={styles.aiBox}>
                  <Text style={styles.aiText}>{aiSummary}</Text>
                </View>
              </View>
            )}
            <Text style={styles.footer}>株式会社クルヒ　©{new Date().getFullYear()}</Text>
          </Page>
        </Document>
      )

      const FullReport = () => (
        <Document>
          <Page size="A4" style={styles.page}>
            <Text style={styles.title}>月次経営総合レポート</Text>
            <Text style={styles.subtitle}>株式会社クルヒ　{props.yearMonth}　作成日: {new Date().toLocaleDateString('ja-JP')}</Text>
            <Text style={styles.reportBadge}>【機密】管理者・経理限定</Text>

            <View style={styles.section}>
              <Text style={styles.sectionTitle}>1. 損益サマリー</Text>
              <View style={styles.summaryGrid}>
                <View style={styles.summaryCard}>
                  <Text style={styles.summaryLabel}>売上高</Text>
                  <Text style={styles.summaryValue}>{(props.revenue / 1000000).toFixed(1)}百万円</Text>
                </View>
                <View style={styles.summaryCard}>
                  <Text style={styles.summaryLabel}>粗利益</Text>
                  <Text style={styles.summaryValue}>{(props.grossProfit / 1000000).toFixed(1)}百万円</Text>
                </View>
                <View style={styles.summaryCard}>
                  <Text style={styles.summaryLabel}>粗利率</Text>
                  <Text style={styles.summaryValue}>{props.grossMargin}%</Text>
                </View>
                <View style={styles.summaryCard}>
                  <Text style={styles.summaryLabel}>製造原価</Text>
                  <Text style={styles.summaryValue}>{(props.mfgCost / 1000000).toFixed(1)}百万円</Text>
                </View>
              </View>
            </View>

            <View style={styles.section}>
              <Text style={styles.sectionTitle}>2. 原価率分析（KPI目標との比較）</Text>
              <View style={styles.headerRow}>
                <Text style={styles.kpiLabel}>項目</Text>
                <Text style={styles.kpiResult}>実績 / 目標 / 判定</Text>
                <Text style={styles.kpiAmount}>金額（円）</Text>
              </View>
              {[
                { label: '材料費率', actual: props.materialRate, target: 18.5, amount: props.materialCost },
                { label: '外注加工費率', actual: props.outsourceRate, target: 43.5, amount: props.outsourceCost },
                { label: '労務費率', actual: props.laborRate, target: 7.0, amount: props.laborCost },
                { label: '荷造運賃率', actual: props.freightRate, target: 1.0, amount: props.freightCost },
              ].map(({ label, actual, target, amount }) => {
                const isGood = Number(actual) <= target
                return (
                  <View key={label} style={styles.kpiRow}>
                    <Text style={styles.kpiLabel}>{label}</Text>
                    <Text style={[styles.kpiResult, isGood ? styles.good : styles.bad]}>
                      {actual}% / {target}% / {isGood ? '目標内' : `${(Number(actual) - target).toFixed(1)}%超過`}
                    </Text>
                    <Text style={styles.kpiAmount}>{Number(amount).toLocaleString()}</Text>
                  </View>
                )
              })}
            </View>

            <View style={styles.section}>
              <Text style={styles.sectionTitle}>3. 販管費 主要項目</Text>
              <View style={styles.headerRow}>
                <Text style={styles.col1}>勘定科目</Text>
                <Text style={styles.col2}>金額（円）</Text>
                <Text style={styles.col3}>構成比</Text>
              </View>
              {sgaItems.map(item => (
                <View key={item.account_name} style={styles.row}>
                  <Text style={styles.col1}>{item.account_name}</Text>
                  <Text style={styles.col2}>{Number(item.balance).toLocaleString()}</Text>
                  <Text style={styles.col3}>{item.ratio}%</Text>
                </View>
              ))}
            </View>

            {aiSummary && (
              <View style={styles.section}>
                <Text style={styles.sectionTitle}>4. AI総評（全社経営分析）</Text>
                <View style={styles.aiBox}>
                  <Text style={styles.aiText}>{aiSummary}</Text>
                </View>
              </View>
            )}
            <Text style={styles.confidential}>機密文書 - 無断配布禁止</Text>
            <Text style={styles.footer}>株式会社クルヒ　©{new Date().getFullYear()}</Text>
          </Page>
        </Document>
      )

      const doc = type === 'mfg' ? <MfgReport /> : <FullReport />
      const blob = await pdf(doc).toBlob()
      const url = URL.createObjectURL(blob)
      const a = document.createElement('a')
      a.href = url
      a.download = `${type === 'mfg' ? '製造原価レポート' : '月次経営総合レポート'}_${props.yearMonth}.pdf`
      a.click()
      URL.revokeObjectURL(url)
    } catch (e) {
      console.error(e)
      alert('PDF生成に失敗しました: ' + String(e))
    } finally {
      setLoading(false)
    }
  }

  return (
    <div className="relative">
      <button
        onClick={() => setShowMenu(!showMenu)}
        disabled={loading || aiLoading}
        className="flex items-center gap-2 bg-gray-800 text-white text-sm font-medium px-4 py-2 rounded-lg hover:bg-gray-900 disabled:opacity-50 transition-colors"
      >
        {loading || aiLoading
          ? <Loader2 className="h-4 w-4 animate-spin" />
          : <FileDown className="h-4 w-4" />}
        {loading ? 'PDF生成中...' : aiLoading ? 'AI総評生成中...' : 'レポートPDF出力'}
        <ChevronDown className="h-3.5 w-3.5" />
      </button>

      {showMenu && (
        <div className="absolute right-0 top-10 bg-white border border-gray-200 rounded-xl shadow-lg z-50 w-56">
          <button
            onClick={() => handleDownload('mfg')}
            className="w-full text-left px-4 py-3 text-sm hover:bg-gray-50 rounded-t-xl border-b border-gray-100"
          >
            <p className="font-medium text-gray-900">① 製造原価レポート</p>
            <p className="text-xs text-gray-400 mt-0.5">製造原価＋AI総評</p>
          </button>
          {canViewFull ? (
            <button
              onClick={() => handleDownload('full')}
              className="w-full text-left px-4 py-3 text-sm hover:bg-gray-50 rounded-b-xl"
            >
              <p className="font-medium text-gray-900">② 全社総合レポート</p>
              <p className="text-xs text-gray-400 mt-0.5">損益全体＋販管費＋AI総評</p>
            </button>
          ) : (
            <div className="px-4 py-3 text-sm text-gray-300 rounded-b-xl">
              <p className="font-medium">② 全社総合レポート</p>
              <p className="text-xs mt-0.5">管理者・経理のみ</p>
            </div>
          )}
        </div>
      )}
    </div>
  )
}
