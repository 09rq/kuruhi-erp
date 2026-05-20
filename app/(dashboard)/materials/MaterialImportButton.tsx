'use client'

import { useRef, useState } from 'react'
import { Upload, Download, X, Check, Loader2 } from 'lucide-react'
import { createClient } from '@/lib/supabase/client'

const VALID_CATEGORIES = ['革', '生地', '金具', 'ファスナー', '箱', '消耗品', 'その他']

interface ImportRow {
  name: string
  short_name: string
  category: string
  spec: string
  unit: string
  standard_price: number | null
  supplier_name: string
  note: string
  _error?: string
}

export default function MaterialImportButton({ onImported }: { onImported: () => void }) {
  const supabase = createClient()
  const fileRef = useRef<HTMLInputElement>(null)
  const [preview, setPreview] = useState<ImportRow[]>([])
  const [showPreview, setShowPreview] = useState(false)
  const [importing, setImporting] = useState(false)
  const [message, setMessage] = useState<{ type: 'success' | 'error'; text: string } | null>(null)

  function handleTemplateDownload() {
    window.open('/templates/materials_import_template.csv', '_blank')
  }

  function parseCSV(text: string): ImportRow[] {
    const lines = text.split('\n').filter(l => l.trim())
    if (lines.length < 2) return []
    const headers = lines[0].split(',').map(h => h.trim().replace(/^"|"$/g, ''))
    return lines.slice(1).map(line => {
      const values = line.split(',').map(v => v.trim().replace(/^"|"$/g, ''))
      const row: Record<string, string> = {}
      headers.forEach((h, i) => { row[h] = values[i] || '' })
      const importRow: ImportRow = {
        name: row.name || '',
        short_name: row.short_name || '',
        category: row.category || '',
        spec: row.spec || '',
        unit: row.unit || '個',
        standard_price: row.standard_price ? Number(row.standard_price) : null,
        supplier_name: row.supplier_name || '',
        note: row.note || '',
      }
      if (!importRow.name) importRow._error = '材料名は必須です'
      else if (!importRow.category) importRow._error = 'カテゴリは必須です'
      return importRow
    }).filter(r => r.name)
  }

  function handleFileChange(e: React.ChangeEvent<HTMLInputElement>) {
    const file = e.target.files?.[0]
    if (!file) return
    const reader = new FileReader()
    reader.onload = (ev) => {
      const text = ev.target?.result as string
      const rows = parseCSV(text)
      setPreview(rows)
      setShowPreview(true)
      setMessage(null)
    }
    reader.readAsText(file, 'UTF-8')
  }

  async function handleImport() {
    const validRows = preview.filter(r => !r._error)
    if (validRows.length === 0) return
    setImporting(true)
    setMessage(null)
    try {
      // supplier_nameからsupplier_idを解決
      const supplierNames = [...new Set(validRows.map(r => r.supplier_name).filter(Boolean))]
      const supplierMap: Record<string, string> = {}
      if (supplierNames.length > 0) {
        const { data: suppliers } = await supabase
          .from('customers')
          .select('id, name, short_name')
          .eq('type', 'vendor_material')
        suppliers?.forEach(s => {
          if (s.name) supplierMap[s.name] = s.id
          if (s.short_name) supplierMap[s.short_name] = s.id
        })
      }

      const chunkSize = 50
      const insertData = validRows.map(r => ({
        name: r.name,
        short_name: r.short_name || null,
        category: r.category,
        spec: r.spec || null,
        unit: r.unit || '個',
        standard_price: r.standard_price,
        supplier_id: r.supplier_name ? (supplierMap[r.supplier_name] || null) : null,
        note: r.note || null,
        is_active: true,
        stock_managed: true,
        inventory_category: true,
        lot_management: false,
        current_stock: 0,
        procurement_type: 'buy',
      }))

      for (let i = 0; i < insertData.length; i += chunkSize) {
        const chunk = insertData.slice(i, i + chunkSize)
        const { error } = await supabase.from('materials').insert(chunk)
        if (error) throw error
      }

      setMessage({ type: 'success', text: `${validRows.length}件をインポートしました` })
      setShowPreview(false)
      setPreview([])
      if (fileRef.current) fileRef.current.value = ''
      onImported()
    } catch (e) {
      console.error(e)
      const errMsg = e instanceof Error ? e.message : JSON.stringify(e)
      setMessage({ type: 'error', text: 'インポートに失敗しました: ' + errMsg })
    } finally { setImporting(false) }
  }

  const errorRows = preview.filter(r => r._error)
  const validRows = preview.filter(r => !r._error)

  return (
    <div className="relative">
      <div className="flex items-center gap-2">
        <button onClick={handleTemplateDownload}
          className="flex items-center gap-1.5 text-xs text-gray-600 border border-gray-300 px-3 py-2 rounded-lg hover:bg-gray-50">
          <Download className="h-3.5 w-3.5" />テンプレート
        </button>
        <button onClick={() => fileRef.current?.click()}
          className="flex items-center gap-1.5 text-xs text-blue-600 border border-blue-300 px-3 py-2 rounded-lg hover:bg-blue-50">
          <Upload className="h-3.5 w-3.5" />CSVインポート
        </button>
        <input ref={fileRef} type="file" accept=".csv" onChange={handleFileChange} className="hidden" />
      </div>

      {message && (
        <div className={`mt-2 text-xs p-2 rounded-lg ${message.type === 'success' ? 'bg-green-50 text-green-700' : 'bg-red-50 text-red-700'}`}>
          {message.text}
        </div>
      )}

      {showPreview && (
        <div className="fixed inset-0 bg-black/50 z-50 flex items-center justify-center p-4">
          <div className="bg-white rounded-2xl shadow-xl w-full max-w-5xl max-h-[80vh] flex flex-col">
            <div className="flex items-center justify-between p-5 border-b border-gray-100">
              <div>
                <h3 className="text-sm font-bold text-gray-900">材料CSVインポート プレビュー</h3>
                <p className="text-xs text-gray-500 mt-0.5">有効: {validRows.length}件 / エラー: {errorRows.length}件</p>
              </div>
              <button onClick={() => setShowPreview(false)} className="text-gray-400 hover:text-gray-600">
                <X className="h-5 w-5" />
              </button>
            </div>

            <div className="overflow-auto flex-1 p-4">
              {errorRows.length > 0 && (
                <div className="bg-red-50 border border-red-200 rounded-lg p-3 mb-4">
                  <p className="text-xs font-medium text-red-700 mb-2">⚠️ 以下の行はエラーのためスキップされます</p>
                  {errorRows.map((r, i) => (
                    <p key={i} className="text-xs text-red-600">{r.name || '（名称なし）'}: {r._error}</p>
                  ))}
                </div>
              )}
              <table className="w-full text-xs">
                <thead>
                  <tr className="bg-gray-50 border-b border-gray-200">
                    <th className="text-left p-2 font-medium text-gray-600">材料名</th>
                    <th className="text-left p-2 font-medium text-gray-600">略称</th>
                    <th className="text-left p-2 font-medium text-gray-600">カテゴリ</th>
                    <th className="text-left p-2 font-medium text-gray-600">仕様</th>
                    <th className="text-left p-2 font-medium text-gray-600">単位</th>
                    <th className="text-left p-2 font-medium text-gray-600">標準単価</th>
                    <th className="text-left p-2 font-medium text-gray-600">仕入先</th>
                    <th className="text-left p-2 font-medium text-gray-600">備考</th>
                  </tr>
                </thead>
                <tbody>
                  {validRows.map((row, i) => (
                    <tr key={i} className="border-b border-gray-100 hover:bg-gray-50">
                      <td className="p-2 font-medium text-gray-900">{row.name}</td>
                      <td className="p-2 text-gray-600">{row.short_name}</td>
                      <td className="p-2">
                        <span className="px-2 py-0.5 rounded-full text-xs font-medium bg-blue-100 text-blue-700">
                          {row.category}
                        </span>
                      </td>
                      <td className="p-2 text-gray-600">{row.spec}</td>
                      <td className="p-2 text-gray-600">{row.unit}</td>
                      <td className="p-2 text-gray-600">{row.standard_price ? `¥${row.standard_price.toLocaleString()}` : '-'}</td>
                      <td className="p-2 text-gray-600">{row.supplier_name}</td>
                      <td className="p-2 text-gray-600">{row.note}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>

            <div className="flex items-center justify-between p-4 border-t border-gray-100">
              <button onClick={() => setShowPreview(false)} className="text-xs text-gray-500 px-4 py-2 rounded-lg hover:bg-gray-100">
                キャンセル
              </button>
              <button onClick={handleImport} disabled={importing || validRows.length === 0}
                className="flex items-center gap-2 bg-blue-600 text-white text-xs font-medium px-5 py-2 rounded-lg hover:bg-blue-700 disabled:opacity-50">
                {importing ? <Loader2 className="h-3.5 w-3.5 animate-spin" /> : <Check className="h-3.5 w-3.5" />}
                {importing ? 'インポート中...' : `${validRows.length}件をインポート`}
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  )
}
