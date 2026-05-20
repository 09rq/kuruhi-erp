'use client'

import { useRef, useState } from 'react'
import { Upload, Download, X, Check, Loader2 } from 'lucide-react'
import { createClient } from '@/lib/supabase/client'

const VALID_TYPES = ['customer', 'vendor_processing', 'vendor_material']
const TYPE_LABELS: Record<string, string> = {
  customer: '販売先',
  vendor_processing: '外注加工先',
  vendor_material: '材料仕入先',
}

interface ImportRow {
  name: string
  short_name: string
  name_kana: string
  type: string
  postal_code: string
  address: string
  phone: string
  fax: string
  email: string
  contact_department: string
  contact_person: string
  note: string
  _error?: string
}

export default function CustomerImportButton({ onImported }: { onImported: () => void }) {
  const supabase = createClient()
  const fileRef = useRef<HTMLInputElement>(null)
  const [preview, setPreview] = useState<ImportRow[]>([])
  const [showPreview, setShowPreview] = useState(false)
  const [importing, setSaving] = useState(false)
  const [message, setMessage] = useState<{ type: 'success' | 'error'; text: string } | null>(null)

  function handleTemplateDownload() {
    window.open('/templates/customers_import_template.csv', '_blank')
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
        name_kana: row.name_kana || '',
        type: row.type || '',
        postal_code: row.postal_code || '',
        address: row.address || '',
        phone: row.phone || '',
        fax: row.fax || '',
        email: row.email || '',
        contact_department: row.contact_department || row['担当者部署'] || '',
        contact_person: row.contact_person || row['得意先担当者名'] || '',
        note: row.note || '',
      }
      if (!importRow.name) importRow._error = '取引先名は必須です'
      else if (!VALID_TYPES.includes(importRow.type)) importRow._error = `区分が不正です（customer / vendor_processing / vendor_material のいずれかを指定）`
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
    reader.readAsText(file, 'Shift-JIS')
  }

  async function handleImport() {
    const validRows = preview.filter(r => !r._error)
    if (validRows.length === 0) return
    setSaving(true)
    setMessage(null)
    try {
      const insertData = validRows.map(r => ({
        name: r.name,
        short_name: r.short_name || null,
        name_kana: r.name_kana || null,
        type: r.type,
        postal_code: r.postal_code || null,
        address: r.address || null,
        phone: r.phone || null,
        fax: r.fax || null,
        email: r.email || null,
        contact_department: r.contact_department || null,
        contact_person: r.contact_person || null,
        note: r.note || null,
        is_active: true,
      }))
      
      // 50件ずつ分割してインポート
      const chunkSize = 50
      for (let i = 0; i < insertData.length; i += chunkSize) {
        const chunk = insertData.slice(i, i + chunkSize)
        const { error } = await supabase.from('customers').insert(chunk)
        if (error) throw error
      }
      setMessage({ type: 'success', text: `${validRows.length}件をインポートしました` })
      setShowPreview(false)
      setPreview([])
      if (fileRef.current) fileRef.current.value = ''
      onImported()
    } catch (e) {
      console.error(e)
      setMessage({ type: 'error', text: 'インポートに失敗しました' })
    } finally { setSaving(false) }
  }

  const errorRows = preview.filter(r => r._error)
  const validRows = preview.filter(r => !r._error)

  return (
    <div className="relative">
      <div className="flex items-center gap-2">
        <button
          onClick={handleTemplateDownload}
          className="flex items-center gap-1.5 text-xs text-gray-600 border border-gray-300 px-3 py-2 rounded-lg hover:bg-gray-50"
        >
          <Download className="h-3.5 w-3.5" />テンプレート
        </button>
        <button
          onClick={() => fileRef.current?.click()}
          className="flex items-center gap-1.5 text-xs text-blue-600 border border-blue-300 px-3 py-2 rounded-lg hover:bg-blue-50"
        >
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
          <div className="bg-white rounded-2xl shadow-xl w-full max-w-4xl max-h-[80vh] flex flex-col">
            <div className="flex items-center justify-between p-5 border-b border-gray-100">
              <div>
                <h3 className="text-sm font-bold text-gray-900">CSVインポート プレビュー</h3>
                <p className="text-xs text-gray-500 mt-0.5">
                  有効: {validRows.length}件 / エラー: {errorRows.length}件
                </p>
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
                    <th className="text-left p-2 font-medium text-gray-600">取引先名</th>
                    <th className="text-left p-2 font-medium text-gray-600">略称</th>
                    <th className="text-left p-2 font-medium text-gray-600">区分</th>
                    <th className="text-left p-2 font-medium text-gray-600">郵便番号</th>
                    <th className="text-left p-2 font-medium text-gray-600">住所</th>
                    <th className="text-left p-2 font-medium text-gray-600">電話</th>
                    <th className="text-left p-2 font-medium text-gray-600">担当者</th>
                  </tr>
                </thead>
                <tbody>
                  {validRows.map((row, i) => (
                    <tr key={i} className="border-b border-gray-100 hover:bg-gray-50">
                      <td className="p-2 font-medium text-gray-900">{row.name}</td>
                      <td className="p-2 text-gray-600">{row.short_name}</td>
                      <td className="p-2">
                        <span className={`px-2 py-0.5 rounded-full text-xs font-medium ${
                          row.type === 'customer' ? 'bg-blue-100 text-blue-700' :
                          row.type === 'vendor_processing' ? 'bg-purple-100 text-purple-700' :
                          'bg-green-100 text-green-700'
                        }`}>
                          {TYPE_LABELS[row.type] || row.type}
                        </span>
                      </td>
                      <td className="p-2 text-gray-600">{row.postal_code}</td>
                      <td className="p-2 text-gray-600 max-w-xs truncate">{row.address}</td>
                      <td className="p-2 text-gray-600">{row.phone}</td>
                      <td className="p-2 text-gray-600">{row.contact_person}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>

            <div className="flex items-center justify-between p-4 border-t border-gray-100">
              <button onClick={() => setShowPreview(false)} className="text-xs text-gray-500 px-4 py-2 rounded-lg hover:bg-gray-100">
                キャンセル
              </button>
              <button
                onClick={handleImport}
                disabled={importing || validRows.length === 0}
                className="flex items-center gap-2 bg-blue-600 text-white text-xs font-medium px-5 py-2 rounded-lg hover:bg-blue-700 disabled:opacity-50"
              >
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
