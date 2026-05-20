'use client'

import { useEffect, useState, useCallback } from 'react'
import { createClient } from '@/lib/supabase/client'
import { TrendingUp, Upload, FileText, AlertCircle } from 'lucide-react'
import AiSummary from './AiSummary'
import CostTrendChart from './CostTrendChart'
import SgaTable from './SgaTable'
import KpiTargetSettings from './KpiTargetSettings'
import FiscalYearTarget from './FiscalYearTarget'
import MonthlyReportPdf from './MonthlyReportPdf'

interface BudgetActual {
  account_name: string
  account_category: string
  balance: number
  ratio: number
  report_type: string
  year_month: string
}

interface ImportHistory {
  id: string
  year_month: string
  report_type: string
  imported_at: string
  row_count: number
}

const REPORT_TYPE_LABELS: Record<string, string> = {
  pl: '損益計算書',
  mfg: '製造原価報告書',
  bs: '貸借対照表',
}

const KEY_ACCOUNTS = ['売上高 計', '売上総損益金額', '材料費 計', '労務費 計', '製造経費 計', '製造原価']

export default function AccountingPage() {
  const supabase = createClient()
  const [myRole, setMyRole] = useState<string | null>(null)
  const [loading, setLoading] = useState(true)
  const [activeTab, setActiveTab] = useState<'dashboard' | 'import'>('dashboard')
  const [importHistory, setImportHistory] = useState<ImportHistory[]>([])
  const [budgetActuals, setBudgetActuals] = useState<BudgetActual[]>([])
  const [uploading, setUploading] = useState(false)
  const [uploadMessage, setUploadMessage] = useState<{ type: 'success' | 'error'; text: string } | null>(null)
  const [selectedMonth, setSelectedMonth] = useState('')
  const [reportType, setReportType] = useState<'pl' | 'mfg' | 'bs'>('pl')

  const fetchData = useCallback(async () => {
    setLoading(true)
    try {
      const { data: { user } } = await supabase.auth.getUser()
      if (!user) return

      const { data: roleData } = await supabase
        .from('user_roles')
        .select('role')
        .eq('user_id', user.id)
        .single()
      setMyRole(roleData?.role ?? null)

      const { data: history } = await supabase
        .from('freee_imports')
        .select('*')
        .order('imported_at', { ascending: false })
        .limit(10)
      setImportHistory(history || [])

      const { data: actuals } = await supabase
        .from('budget_actuals')
        .select('*')
        .order('year_month', { ascending: false })
      setBudgetActuals(actuals || [])

      if (!selectedMonth && history && history.length > 0) {
        setSelectedMonth(history[0].year_month)
      }
    } catch (e) { console.error(e) } finally { setLoading(false) }
  }, [supabase, selectedMonth])

  useEffect(() => { fetchData() }, [fetchData])

  function parseFreeeCSV(text: string, type: string): BudgetActual[] {
    const lines = text.split('\n').filter(l => l.trim())
    const results: BudgetActual[] = []
    let currentCategory = ''

    for (let i = 2; i < lines.length; i++) {
      const cols = lines[i].split(',').map(c => c.replace(/"/g, '').trim())
      if (!cols[0] || cols[0] === '') continue

      const name = cols[0]
      const isCategory = type === 'bs'
        ? (cols[1] === '' && cols[2] === '' && cols[3] === '' && cols[4] === '')
        : (cols[1] === '' && cols[2] === '' && cols[3] === '' && cols[4] === '')

      if (isCategory) {
        currentCategory = name
        continue
      }

      let balance = 0
      let ratio = 0
      let debit = 0
      let credit = 0

      if (type === 'bs') {
        debit = Number(cols[2]?.replace(/,/g, '') || 0)
        credit = Number(cols[3]?.replace(/,/g, '') || 0)
        balance = Number(cols[4]?.replace(/,/g, '') || 0)
        ratio = Number(cols[5]?.replace(/,/g, '') || 0)
      } else {
        debit = Number(cols[1]?.replace(/,/g, '') || 0)
        credit = Number(cols[2]?.replace(/,/g, '') || 0)
        balance = Number(cols[3]?.replace(/,/g, '') || 0)
        ratio = Number(cols[4]?.replace(/,/g, '') || 0)
      }

      if (name && (debit !== 0 || credit !== 0 || balance !== 0)) {
        results.push({
          account_name: name,
          account_category: currentCategory,
          balance,
          ratio,
          report_type: type,
          year_month: selectedMonth,
        })
      }
    }
    return results
  }

  async function handleFileUpload(e: React.ChangeEvent<HTMLInputElement>) {
    const file = e.target.files?.[0]
    if (!file || !selectedMonth) {
      setUploadMessage({ type: 'error', text: '対象月とファイルを選択してください' })
      return
    }

    setUploading(true)
    setUploadMessage(null)

    try {
      const { data: { user } } = await supabase.auth.getUser()
      if (!user) throw new Error('ログインが必要です')

      const buffer = await file.arrayBuffer()
      const decoder = new TextDecoder('shift-jis')
      const text = decoder.decode(buffer)

      const rows = parseFreeeCSV(text, reportType)
      if (rows.length === 0) throw new Error('データが読み取れませんでした')

      const { data: importRecord, error: importError } = await supabase
        .from('freee_imports')
        .insert({
          year_month: selectedMonth,
          report_type: reportType,
          imported_by: user.id,
          row_count: rows.length,
        })
        .select()
        .single()

      if (importError) throw importError

      const insertData = rows.map(r => ({ ...r, import_id: importRecord.id }))

      await supabase.from('budget_actuals').delete()
        .eq('year_month', selectedMonth)
        .eq('report_type', reportType)

      const { error: dataError } = await supabase
        .from('budget_actuals')
        .insert(insertData)

      if (dataError) throw dataError

      setUploadMessage({ type: 'success', text: `${rows.length}件のデータを取り込みました` })
      fetchData()
    } catch (err: unknown) {
      const message = err instanceof Error ? err.message : 'エラーが発生しました'
      setUploadMessage({ type: 'error', text: message })
    } finally {
      setUploading(false)
      e.target.value = ''
    }
  }

  const filteredActuals = budgetActuals.filter(a =>
    (!selectedMonth || a.year_month === selectedMonth)
  )

  const plData = filteredActuals.filter(a => a.report_type === 'pl')
  const mfgData = filteredActuals.filter(a => a.report_type === 'mfg')

  const revenue = plData.find(a => a.account_name === '売上高 計')?.balance || 0
  const grossProfit = plData.find(a => a.account_name === '売上総損益金額')?.balance || 0
  const mfgCost = mfgData.find(a => a.account_name === '製造原価')?.balance || 0
  const materialCost = mfgData.find(a => a.account_name === '材料費 計')?.balance || 0
  const laborCost = mfgData.find(a => a.account_name === '労務費 計')?.balance || 0
  const outsourceCost = mfgData.find(a => a.account_name === '[製]外注加工費')?.balance || 0
  const freightCost = mfgData.find(a => a.account_name === '[製]荷造運賃')?.balance || 0

  const grossMargin = revenue > 0 ? ((grossProfit / revenue) * 100).toFixed(1) : '0.0'
  const materialRate = revenue > 0 ? ((materialCost / revenue) * 100).toFixed(1) : '0.0'
  const laborRate = revenue > 0 ? ((laborCost / revenue) * 100).toFixed(1) : '0.0'
  const outsourceRate = revenue > 0 ? ((outsourceCost / revenue) * 100).toFixed(1) : '0.0'
  const freightRate = revenue > 0 ? ((freightCost / revenue) * 100).toFixed(1) : '0.0'

  if (loading) return <div className="flex items-center justify-center h-64"><div className="animate-spin rounded-full h-8 w-8 border-b-2 border-blue-600" /></div>

  if (!['admin', 'accounting'].includes(myRole || '')) {
    return (
      <div className="flex flex-col items-center justify-center h-64 gap-4 text-gray-500">
        <AlertCircle className="h-12 w-12 text-red-400" />
        <p className="text-lg font-medium">この画面は管理者・経理のみ閲覧できます</p>
      </div>
    )
  }

  return (
    <div className="p-6 max-w-5xl mx-auto">
      <div className="flex items-center gap-3 mb-6">
        <div className="p-2 bg-green-100 rounded-lg"><TrendingUp className="h-6 w-6 text-green-700" /></div>
        <div>
          <h1 className="text-xl font-bold text-gray-900">予実管理</h1>
          <p className="text-sm text-gray-500">freee会計CSVを取り込んで予実を管理します</p>
        </div>
      </div>

      <div className="flex gap-2 mb-6">
        <button onClick={() => setActiveTab('dashboard')} className={`px-4 py-2 rounded-lg text-sm font-medium transition-colors ${activeTab === 'dashboard' ? 'bg-green-600 text-white' : 'bg-gray-100 text-gray-600 hover:bg-gray-200'}`}>
          ダッシュボード
        </button>
        {activeTab === 'dashboard' && revenue > 0 && selectedMonth && (
          <MonthlyReportPdf
            yearMonth={selectedMonth}
            revenue={revenue}
            grossProfit={grossProfit}
            grossMargin={grossMargin}
            mfgCost={mfgCost}
            materialRate={materialRate}
            outsourceRate={outsourceRate}
            laborRate={laborRate}
            freightRate={freightRate}
            materialCost={materialCost}
            outsourceCost={outsourceCost}
            laborCost={laborCost}
            freightCost={freightCost}
            plData={plData}
            mfgData={mfgData}
            aiSummary=''
            userRole={myRole || ''}
          />
        )}
        <button onClick={() => setActiveTab('import')} className={`px-4 py-2 rounded-lg text-sm font-medium transition-colors ${activeTab === 'import' ? 'bg-green-600 text-white' : 'bg-gray-100 text-gray-600 hover:bg-gray-200'}`}>
          <Upload className="h-4 w-4 inline mr-1" />CSVインポート
        </button>
      </div>

      {activeTab === 'dashboard' && revenue === 0 && (<div></div>)}
      {activeTab === 'dashboard' && (<CostTrendChart />)}
      {activeTab === 'dashboard' && (
        <div>
          <div className="flex gap-3 mb-6">
            <div>
              <label className="text-xs font-medium text-gray-500 mb-1 block">表示する月</label>
              <select
                value={selectedMonth}
                onChange={e => setSelectedMonth(e.target.value)}
                className="text-sm border border-gray-300 rounded-lg px-3 py-2 bg-white focus:outline-none focus:ring-2 focus:ring-green-500"
              >
                <option value="">月を選択</option>
                {[...new Set(budgetActuals.map(a => a.year_month))].sort().reverse().map(m => (
                  <option key={m} value={m}>{m}</option>
                ))}
              </select>
            </div>
          </div>

          {revenue === 0 ? (
            <div className="bg-gray-50 border border-gray-200 rounded-2xl p-12 text-center">
              <FileText className="h-12 w-12 text-gray-300 mx-auto mb-3" />
              <p className="text-gray-500 font-medium">データがありません</p>
              <p className="text-gray-400 text-sm mt-1">「CSVインポート」タブからfreeeのCSVを取り込んでください</p>
            </div>
          ) : (
            <>
              <div className="grid grid-cols-2 md:grid-cols-4 gap-4 mb-6">
                {[
                  { label: '売上高', value: revenue, unit: '円', color: 'bg-blue-50 border-blue-200', textColor: 'text-blue-700' },
                  { label: '粗利益', value: grossProfit, unit: '円', color: 'bg-green-50 border-green-200', textColor: 'text-green-700' },
                  { label: '粗利率', value: grossMargin, unit: '%', color: 'bg-purple-50 border-purple-200', textColor: 'text-purple-700' },
                  { label: '製造原価', value: mfgCost, unit: '円', color: 'bg-orange-50 border-orange-200', textColor: 'text-orange-700' },
                ].map(({ label, value, unit, color, textColor }) => (
                  <div key={label} className={`border rounded-xl p-4 ${color}`}>
                    <p className="text-xs font-medium text-gray-500 mb-1">{label}</p>
                    <p className={`text-lg font-bold ${textColor}`}>
                      {unit === '円' ? Number(value).toLocaleString() : value}{unit}
                    </p>
                  </div>
                ))}
              </div>

              <div className="bg-white border border-gray-200 rounded-2xl p-6 mb-6">
                <h3 className="text-sm font-bold text-gray-900 mb-4">原価率分析（KPI目標との比較）</h3>
                <div className="space-y-4">
                  {[
                    { label: '材料費率', actual: materialRate, target: 18.5, amount: materialCost },
                    { label: '外注加工費率', actual: outsourceRate, target: 43.5, amount: outsourceCost },
                    { label: '労務費率', actual: laborRate, target: 7.0, amount: laborCost },
                    { label: '荷造運賃率', actual: freightRate, target: 1.0, amount: freightCost },
                  ].map(({ label, actual, target, amount }) => {
                    const actualNum = Number(actual)
                    const isGood = actualNum <= target
                    return (
                      <div key={label}>
                        <div className="flex justify-between items-center mb-1">
                          <span className="text-sm font-medium text-gray-700">{label}</span>
                          <div className="flex items-center gap-3">
                            <span className="text-xs text-gray-400">目標 {target}%</span>
                            <span className={`text-sm font-bold ${isGood ? 'text-green-600' : 'text-red-600'}`}>
                              実績 {actual}%
                            </span>
                            <span className={`text-xs font-medium px-2 py-0.5 rounded-full ${isGood ? 'bg-green-100 text-green-700' : 'bg-red-100 text-red-700'}`}>
                              {isGood ? '✓ 目標内' : `▲ ${(actualNum - target).toFixed(1)}%超過`}
                            </span>
                          </div>
                        </div>
                        <div className="w-full bg-gray-100 rounded-full h-2 relative">
                          <div
                            className={`h-2 rounded-full ${isGood ? 'bg-green-500' : 'bg-red-500'}`}
                            style={{ width: `${Math.min(100, (actualNum / (target * 2)) * 100)}%` }}
                          />
                          <div
                            className="absolute top-0 h-2 w-0.5 bg-gray-400"
                            style={{ left: `${Math.min(100, (target / (target * 2)) * 100)}%` }}
                          />
                        </div>
                        <p className="text-xs text-gray-400 mt-0.5">{Number(amount).toLocaleString()}円</p>
                      </div>
                    )
                  })}
                </div>
              </div>

              <div className="bg-white border border-gray-200 rounded-2xl p-6">
                <h3 className="text-sm font-bold text-gray-900 mb-4">損益計算書 主要項目</h3>
                <table className="w-full">
                  <thead className="bg-gray-50">
                    <tr>
                      <th className="text-left text-xs font-medium text-gray-500 px-3 py-2">勘定科目</th>
                      <th className="text-right text-xs font-medium text-gray-500 px-3 py-2">金額（円）</th>
                      <th className="text-right text-xs font-medium text-gray-500 px-3 py-2">構成比</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-gray-100">
                    {plData.filter(a => KEY_ACCOUNTS.includes(a.account_name) || a.account_category === '販売管理費').map(a => (
                      <tr key={a.account_name} className={`${KEY_ACCOUNTS.includes(a.account_name) ? 'bg-blue-50 font-medium' : ''}`}>
                        <td className="text-sm text-gray-800 px-3 py-2">{a.account_name}</td>
                        <td className="text-sm text-right text-gray-800 px-3 py-2">{Number(a.balance).toLocaleString()}</td>
                        <td className="text-sm text-right text-gray-500 px-3 py-2">{a.ratio}%</td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            </>
          )}
        </div>
      )}

      {activeTab === 'import' && (
        <div>
          <div className="bg-white border border-gray-200 rounded-2xl p-6 mb-6">
            <h3 className="text-sm font-bold text-gray-900 mb-4">freee CSVファイルを取り込む</h3>
            <div className="grid grid-cols-2 gap-4 mb-4">
              <div>
                <label className="text-xs font-medium text-gray-500 mb-1 block">対象月</label>
                <input
                  type="month"
                  value={selectedMonth}
                  onChange={e => setSelectedMonth(e.target.value)}
                  className="w-full text-sm border border-gray-300 rounded-lg px-3 py-2 focus:outline-none focus:ring-2 focus:ring-green-500"
                />
              </div>
              <div>
                <label className="text-xs font-medium text-gray-500 mb-1 block">レポート種類</label>
                <select
                  value={reportType}
                  onChange={e => setReportType(e.target.value as 'pl' | 'mfg' | 'bs')}
                  className="w-full text-sm border border-gray-300 rounded-lg px-3 py-2 bg-white focus:outline-none focus:ring-2 focus:ring-green-500"
                >
                  <option value="pl">損益計算書</option>
                  <option value="mfg">製造原価報告書</option>
                  <option value="bs">貸借対照表</option>
                </select>
              </div>
            </div>

            <div className="border-2 border-dashed border-gray-300 rounded-xl p-8 text-center mb-4">
              <Upload className="h-8 w-8 text-gray-300 mx-auto mb-2" />
              <p className="text-sm text-gray-500 mb-3">freeeから出力したCSVファイルを選択してください</p>
              <label className="cursor-pointer bg-green-600 text-white text-sm font-medium px-6 py-2 rounded-lg hover:bg-green-700 transition-colors">
                {uploading ? '取り込み中...' : 'ファイルを選択'}
                <input type="file" accept=".csv" onChange={handleFileUpload} disabled={uploading} className="hidden" />
              </label>
            </div>

            {uploadMessage && (
              <div className={`p-3 rounded-lg text-sm ${uploadMessage.type === 'success' ? 'bg-green-50 text-green-800 border border-green-200' : 'bg-red-50 text-red-800 border border-red-200'}`}>
                {uploadMessage.text}
              </div>
            )}
          </div>

          <div className="bg-white border border-gray-200 rounded-2xl p-6">
            <h3 className="text-sm font-bold text-gray-900 mb-4">取り込み履歴</h3>
            {importHistory.length === 0 ? (
              <p className="text-gray-400 text-sm text-center py-4">取り込み履歴がありません</p>
            ) : (
              <table className="w-full">
                <thead className="bg-gray-50">
                  <tr>
                    <th className="text-left text-xs font-medium text-gray-500 px-3 py-2">対象月</th>
                    <th className="text-left text-xs font-medium text-gray-500 px-3 py-2">種類</th>
                    <th className="text-left text-xs font-medium text-gray-500 px-3 py-2">件数</th>
                    <th className="text-left text-xs font-medium text-gray-500 px-3 py-2">取り込み日時</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-gray-100">
                  {importHistory.map(h => (
                    <tr key={h.id}>
                      <td className="text-sm text-gray-800 px-3 py-2">{h.year_month}</td>
                      <td className="text-sm text-gray-800 px-3 py-2">{REPORT_TYPE_LABELS[h.report_type]}</td>
                      <td className="text-sm text-gray-800 px-3 py-2">{h.row_count}件</td>
                      <td className="text-sm text-gray-400 px-3 py-2">{new Date(h.imported_at).toLocaleString('ja-JP')}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            )}
          </div>
        </div>
      )}
      {activeTab === "dashboard" && revenue > 0 && (
        <AiSummary yearMonth={selectedMonth} plData={plData} mfgData={mfgData} />
      )}
      {activeTab === "dashboard" && selectedMonth && (
        <SgaTable yearMonth={selectedMonth} />
      )}
      {activeTab === "dashboard" && (
        <KpiTargetSettings />
      )}
      {activeTab === "dashboard" && (
        <FiscalYearTarget />
      )}
    </div>
  )
}
