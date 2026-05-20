'use client'

import { useEffect, useState, useCallback } from 'react'
import { createClient } from '@/lib/supabase/client'
import { Plus, Trash2, FileDown, Loader2, ChevronDown, ChevronUp } from 'lucide-react'

type BomSection = 'leather' | 'fabric' | 'core' | 'hardware' | 'fastener' | 'other'

const SECTION_LABELS: Record<BomSection, string> = {
  leather: '革',
  fabric: '生地',
  core: '芯材',
  hardware: '金具',
  fastener: 'ファスナー',
  other: 'その他資材',
}

const SECTION_COLORS: Record<BomSection, string> = {
  leather: 'bg-amber-50 border-amber-200',
  fabric: 'bg-blue-50 border-blue-200',
  core: 'bg-gray-50 border-gray-200',
  hardware: 'bg-yellow-50 border-yellow-200',
  fastener: 'bg-purple-50 border-purple-200',
  other: 'bg-green-50 border-green-200',
}

interface BomPart {
  id?: string
  bom_id: string
  section: BomSection
  material_name: string
  part_name: string
  quantity: number
  width_cm: number | null
  height_cm: number | null
  ds_count: number | null
  model_type: string
  spec: string
  sort_order: number
}

interface BomNote {
  id?: string
  bom_id: string
  note_type: 'production' | 'inspection'
  content: string
  sort_order: number
}

interface Props {
  bomId: string
  productName: string
  productNo: string
  brandName?: string
  version: number
  canEdit: boolean
}

export default function BomPartsEditor({ bomId, productName, productNo, brandName, version, canEdit }: Props) {
  const supabase = createClient()
  const [parts, setParts] = useState<BomPart[]>([])
  const [notes, setNotes] = useState<BomNote[]>([])
  const [loading, setLoading] = useState(true)
  const [saving, setSaving] = useState(false)
  const [pdfLoading, setPdfLoading] = useState(false)
  const [message, setMessage] = useState<string | null>(null)
  const [expandedSections, setExpandedSections] = useState<Record<string, boolean>>({
    leather: true, fabric: true, core: true, hardware: true, fastener: true, other: true,
    production: true, inspection: true,
  })

  const fetchData = useCallback(async () => {
    setLoading(true)
    try {
      const { data: partsData } = await supabase.from('bom_parts').select('*').eq('bom_id', bomId).order('section').order('sort_order')
      const { data: notesData } = await supabase.from('bom_notes').select('*').eq('bom_id', bomId).order('note_type').order('sort_order')
      setParts(partsData || [])
      setNotes(notesData || [])
    } catch (e) { console.error(e) } finally { setLoading(false) }
  }, [supabase, bomId])

  useEffect(() => { fetchData() }, [fetchData])

  function calcDs(width: number | null, height: number | null, qty: number): number | null {
    if (!width || !height) return null
    return width * height * qty
  }

  function addPart(section: BomSection) {
    const sectionParts = parts.filter(p => p.section === section)
    setParts(prev => [...prev, {
      bom_id: bomId, section, material_name: '', part_name: '', quantity: 1,
      width_cm: null, height_cm: null, ds_count: null, model_type: '', spec: '',
      sort_order: sectionParts.length,
    }])
  }

  function updatePart(idx: number, updates: Partial<BomPart>) {
    setParts(prev => prev.map((p, i) => {
      if (i !== idx) return p
      const updated = { ...p, ...updates }
      if (['width_cm', 'height_cm', 'quantity'].some(k => k in updates)) {
        updated.ds_count = calcDs(updated.width_cm, updated.height_cm, updated.quantity)
      }
      return updated
    }))
  }

  function removePart(idx: number) {
    setParts(prev => prev.filter((_, i) => i !== idx))
  }

  function addNote(noteType: 'production' | 'inspection') {
    const typeNotes = notes.filter(n => n.note_type === noteType)
    setNotes(prev => [...prev, { bom_id: bomId, note_type: noteType, content: '', sort_order: typeNotes.length }])
  }

  function updateNote(idx: number, content: string) {
    setNotes(prev => prev.map((n, i) => i === idx ? { ...n, content } : n))
  }

  function removeNote(idx: number) {
    setNotes(prev => prev.filter((_, i) => i !== idx))
  }

  async function handleSave() {
    setSaving(true)
    setMessage(null)
    try {
      // 既存データ削除して再登録
      await supabase.from('bom_parts').delete().eq('bom_id', bomId)
      await supabase.from('bom_notes').delete().eq('bom_id', bomId)

      if (parts.length > 0) {
        await supabase.from('bom_parts').insert(parts.map(p => ({
          bom_id: bomId, section: p.section, material_name: p.material_name || null,
          part_name: p.part_name, quantity: p.quantity, width_cm: p.width_cm,
          height_cm: p.height_cm, ds_count: p.ds_count, model_type: p.model_type || null,
          spec: p.spec || null, sort_order: p.sort_order,
        })))
      }

      if (notes.length > 0) {
        await supabase.from('bom_notes').insert(notes.filter(n => n.content).map(n => ({
          bom_id: bomId, note_type: n.note_type, content: n.content, sort_order: n.sort_order,
        })))
      }

      setMessage('保存しました')
      setTimeout(() => setMessage(null), 3000)
      fetchData()
    } catch (e) {
      console.error(e)
      setMessage('保存に失敗しました')
    } finally { setSaving(false) }
  }

  async function handlePdfDownload() {
    setPdfLoading(true)
    try {
      const { pdf, Document, Page, Text, View, StyleSheet, Font } = await import('@react-pdf/renderer')
      Font.register({ family: 'NotoSans', src: '/NotoSans.otf' })

      const today = new Date().toLocaleDateString('ja-JP')
      const sections: BomSection[] = ['leather', 'fabric', 'core', 'hardware', 'fastener', 'other']
      const productionNotes = notes.filter(n => n.note_type === 'production')
      const inspectionNotes = notes.filter(n => n.note_type === 'inspection')

      const styles = StyleSheet.create({
        page: { padding: 25, fontSize: 8, fontFamily: 'NotoSans' },
        title: { fontSize: 14, fontWeight: 'bold', textAlign: 'center', marginBottom: 3 },
        subtitle: { fontSize: 8, color: '#666', textAlign: 'center', marginBottom: 10 },
        infoRow: { flexDirection: 'row', gap: 6, marginBottom: 10 },
        infoCard: { flex: 1, padding: 6, backgroundColor: '#f0f4ff', borderRadius: 3 },
        infoLabel: { fontSize: 6, color: '#666', marginBottom: 1 },
        infoValue: { fontSize: 9, fontWeight: 'bold', color: '#1e3a5f' },
        sectionTitle: { fontSize: 9, fontWeight: 'bold', padding: 4, color: 'white', marginBottom: 0 },
        tableHeader: { flexDirection: 'row', backgroundColor: '#f3f4f6', borderBottomWidth: 1, borderBottomColor: '#d1d5db', paddingVertical: 3 },
        tableRow: { flexDirection: 'row', borderBottomWidth: 1, borderBottomColor: '#e5e7eb', paddingVertical: 3 },
        colNo: { width: 22, paddingHorizontal: 3 },
        colMaterial: { width: 55, paddingHorizontal: 3 },
        colPart: { flex: 2, paddingHorizontal: 3 },
        colQty: { width: 35, paddingHorizontal: 3, textAlign: 'center' },
        colWidth: { width: 45, paddingHorizontal: 3, textAlign: 'right' },
        colHeight: { width: 45, paddingHorizontal: 3, textAlign: 'right' },
        colDs: { width: 55, paddingHorizontal: 3, textAlign: 'right' },
        colModel: { width: 55, paddingHorizontal: 3 },
        colSpec: { flex: 2, paddingHorizontal: 3 },
        checkTitle: { fontSize: 9, fontWeight: 'bold', padding: 4, backgroundColor: '#166534', color: 'white', marginTop: 8, marginBottom: 4 },
        checkGrid: { flexDirection: 'row', flexWrap: 'wrap', gap: 3 },
        checkItem: { width: '18%', flexDirection: 'row', alignItems: 'center', gap: 3, padding: 3, borderWidth: 1, borderColor: '#d1d5db', borderRadius: 2 },
        checkBox: { width: 10, height: 10, borderWidth: 1, borderColor: '#666', borderRadius: 1 },
        checkLabel: { fontSize: 7, color: '#374151', flex: 1 },
        checkQty: { fontSize: 7, color: '#166534', fontWeight: 'bold' },
        noteTitle: { fontSize: 9, fontWeight: 'bold', padding: 4, backgroundColor: '#7c3aed', color: 'white', marginTop: 8, marginBottom: 4 },
        noteItem: { fontSize: 8, padding: 3, borderBottomWidth: 1, borderBottomColor: '#e5e7eb' },
        signRow: { flexDirection: 'row', gap: 8, marginTop: 12 },
        signBox: { flex: 1, borderWidth: 1, borderColor: '#d1d5db', borderRadius: 3, padding: 6, height: 35 },
        signLabel: { fontSize: 6, color: '#9ca3af' },
        footer: { position: 'absolute', bottom: 12, left: 25, right: 25, flexDirection: 'row', justifyContent: 'space-between', fontSize: 6, color: '#9ca3af' },
      })

      const SECTION_BG: Record<BomSection, string> = {
        leather: '#92400e', fabric: '#1e40af', core: '#374151',
        hardware: '#92400e', fastener: '#5b21b6', other: '#166534',
      }

      const MyDoc = () => (
        <Document>
          <Page size="A4" style={styles.page} orientation="landscape">
            <Text style={styles.title}>《 部 材 表 》</Text>
            <Text style={styles.subtitle}>株式会社クルヒ　作成日: {today}</Text>

            <View style={styles.infoRow}>
              <View style={styles.infoCard}><Text style={styles.infoLabel}>製品名</Text><Text style={styles.infoValue}>{productName}</Text></View>
              <View style={styles.infoCard}><Text style={styles.infoLabel}>品番</Text><Text style={styles.infoValue}>{productNo}</Text></View>
              {brandName && <View style={styles.infoCard}><Text style={styles.infoLabel}>ブランド</Text><Text style={styles.infoValue}>{brandName}</Text></View>}
              <View style={styles.infoCard}><Text style={styles.infoLabel}>バージョン</Text><Text style={styles.infoValue}>Rev.{version}</Text></View>
            </View>

            {sections.map(section => {
              const sectionParts = parts.filter(p => p.section === section)
              if (sectionParts.length === 0) return null
              return (
                <View key={section}>
                  <Text style={[styles.sectionTitle, { backgroundColor: SECTION_BG[section] }]}>
                    {SECTION_LABELS[section]}
                  </Text>
                  <View style={styles.tableHeader}>
                    <Text style={styles.colNo}>No.</Text>
                    <Text style={styles.colMaterial}>材料名</Text>
                    <Text style={styles.colPart}>パーツ名</Text>
                    <Text style={styles.colQty}>枚数</Text>
                    <Text style={styles.colWidth}>横(cm)</Text>
                    <Text style={styles.colHeight}>縦(cm)</Text>
                    <Text style={styles.colDs}>必要DS数</Text>
                    <Text style={styles.colModel}>本型/荒型</Text>
                    <Text style={styles.colSpec}>仕様・備考</Text>
                  </View>
                  {sectionParts.map((part, idx) => (
                    <View key={idx} style={[styles.tableRow, idx % 2 === 0 ? {} : { backgroundColor: '#f9fafb' }]}>
                      <Text style={styles.colNo}>{idx + 1}</Text>
                      <Text style={styles.colMaterial}>{part.material_name}</Text>
                      <Text style={styles.colPart}>{part.part_name}</Text>
                      <Text style={styles.colQty}>{part.quantity}</Text>
                      <Text style={styles.colWidth}>{part.width_cm || '-'}</Text>
                      <Text style={styles.colHeight}>{part.height_cm || '-'}</Text>
                      <Text style={styles.colDs}>{part.ds_count ? part.ds_count.toFixed(1) : '-'}</Text>
                      <Text style={styles.colModel}>{part.model_type}</Text>
                      <Text style={styles.colSpec}>{part.spec}</Text>
                    </View>
                  ))}
                </View>
              )
            })}

            {parts.length > 0 && (
              <>
                <Text style={styles.checkTitle}>部材確認チェックリスト（品質管理部用）</Text>
                <View style={styles.checkGrid}>
                  {parts.filter(p => p.part_name).map((part, idx) => (
                    <View key={idx} style={styles.checkItem}>
                      <View style={styles.checkBox} />
                      <Text style={styles.checkLabel}>{part.part_name}</Text>
                      <Text style={styles.checkQty}>{part.quantity}枚</Text>
                    </View>
                  ))}
                </View>
              </>
            )}

            {productionNotes.length > 0 && (
              <>
                <Text style={styles.noteTitle}>注意事項（生産時）- 企画開発部より</Text>
                {productionNotes.map((note, idx) => (
                  <Text key={idx} style={styles.noteItem}>・{note.content}</Text>
                ))}
              </>
            )}

            {inspectionNotes.length > 0 && (
              <>
                <Text style={[styles.noteTitle, { backgroundColor: '#b45309' }]}>注意事項（検品時）- 企画開発部より</Text>
                {inspectionNotes.map((note, idx) => (
                  <Text key={idx} style={styles.noteItem}>・{note.content}</Text>
                ))}
              </>
            )}

            <View style={styles.signRow}>
              <View style={styles.signBox}><Text style={styles.signLabel}>作成者（企画開発部）</Text></View>
              <View style={styles.signBox}><Text style={styles.signLabel}>確認者（小淵 陽介）</Text></View>
              <View style={styles.signBox}><Text style={styles.signLabel}>部材確認（品質管理部）</Text></View>
              <View style={styles.signBox}><Text style={styles.signLabel}>確認日：　　年　　月　　日</Text></View>
            </View>

            <View style={styles.footer}>
              <Text>株式会社クルヒ　部材表　{productNo}　©{new Date().getFullYear()}</Text>
              <Text>機密文書 - 無断配布禁止</Text>
            </View>
          </Page>
        </Document>
      )

      const blob = await pdf(<MyDoc />).toBlob()
      const url = URL.createObjectURL(blob)
      const a = document.createElement('a')
      a.href = url
      a.download = `部材表_${productNo}_${productName}.pdf`
      a.click()
      URL.revokeObjectURL(url)
    } catch (e) {
      console.error(e)
      alert('PDF生成に失敗しました: ' + String(e))
    } finally { setPdfLoading(false) }
  }

  if (loading) return <div className="flex items-center justify-center h-32"><div className="animate-spin rounded-full h-6 w-6 border-b-2 border-blue-600" /></div>

  const sections: BomSection[] = ['leather', 'fabric', 'core', 'hardware', 'fastener', 'other']

  return (
    <div className="space-y-4">
      <div className="flex items-center justify-between">
        <h3 className="text-sm font-bold text-gray-900">部材表</h3>
        <div className="flex items-center gap-2">
          {message && <span className={`text-xs ${message.includes('失敗') ? 'text-red-600' : 'text-green-600'}`}>{message}</span>}
          {canEdit && (
            <button onClick={handleSave} disabled={saving} className="flex items-center gap-1.5 bg-blue-600 text-white text-xs font-medium px-3 py-2 rounded-lg hover:bg-blue-700 disabled:opacity-50">
              {saving ? '保存中...' : '保存する'}
            </button>
          )}
          <button onClick={handlePdfDownload} disabled={pdfLoading} className="flex items-center gap-1.5 bg-green-700 text-white text-xs font-medium px-3 py-2 rounded-lg hover:bg-green-800 disabled:opacity-50">
            {pdfLoading ? <Loader2 className="h-3.5 w-3.5 animate-spin" /> : <FileDown className="h-3.5 w-3.5" />}
            部材表PDF
          </button>
        </div>
      </div>

      {sections.map(section => {
        const sectionParts = parts.map((p, i) => ({ ...p, _idx: i })).filter(p => p.section === section)
        const isExpanded = expandedSections[section]
        return (
          <div key={section} className={`border rounded-xl overflow-hidden ${SECTION_COLORS[section]}`}>
            <button onClick={() => setExpandedSections(p => ({ ...p, [section]: !p[section] }))}
              className="w-full flex items-center justify-between px-4 py-3 hover:opacity-80">
              <span className="text-sm font-bold text-gray-900">{SECTION_LABELS[section]}（{sectionParts.length}点）</span>
              {isExpanded ? <ChevronUp className="h-4 w-4 text-gray-500" /> : <ChevronDown className="h-4 w-4 text-gray-500" />}
            </button>

            {isExpanded && (
              <div className="border-t border-gray-200 bg-white">
                {sectionParts.length > 0 && (
                  <div className="overflow-x-auto">
                    <table className="w-full text-xs">
                      <thead>
                        <tr className="bg-gray-50 border-b border-gray-200">
                          <th className="text-left p-2 font-medium text-gray-600 w-8">No.</th>
                          <th className="text-left p-2 font-medium text-gray-600 w-28">材料名</th>
                          <th className="text-left p-2 font-medium text-gray-600">パーツ名</th>
                          <th className="text-left p-2 font-medium text-gray-600 w-16">枚数</th>
                          {['leather', 'fabric', 'core'].includes(section) && (
                            <>
                              <th className="text-left p-2 font-medium text-gray-600 w-20">横(cm)</th>
                              <th className="text-left p-2 font-medium text-gray-600 w-20">縦(cm)</th>
                              <th className="text-left p-2 font-medium text-gray-600 w-24">DS数</th>
                              <th className="text-left p-2 font-medium text-gray-600 w-24">本型/荒型</th>
                            </>
                          )}
                          <th className="text-left p-2 font-medium text-gray-600">仕様・備考</th>
                          {canEdit && <th className="w-8"></th>}
                        </tr>
                      </thead>
                      <tbody>
                        {sectionParts.map((part, i) => (
                          <tr key={i} className="border-b border-gray-100 hover:bg-gray-50">
                            <td className="p-2 text-gray-500">{i + 1}</td>
                            <td className="p-2">
                              {canEdit ? (
                                <input type="text" value={part.material_name} onChange={e => updatePart(part._idx, { material_name: e.target.value })}
                                  placeholder="例：表革" className="w-full border border-gray-200 rounded px-2 py-1 focus:outline-none focus:ring-1 focus:ring-blue-500" />
                              ) : <span>{part.material_name}</span>}
                            </td>
                            <td className="p-2">
                              {canEdit ? (
                                <input type="text" value={part.part_name} onChange={e => updatePart(part._idx, { part_name: e.target.value })}
                                  placeholder="例：マチ" className="w-full border border-gray-200 rounded px-2 py-1 focus:outline-none focus:ring-1 focus:ring-blue-500" />
                              ) : <span>{part.part_name}</span>}
                            </td>
                            <td className="p-2">
                              {canEdit ? (
                                <input type="number" value={part.quantity} onChange={e => updatePart(part._idx, { quantity: Number(e.target.value) })}
                                  min={1} className="w-full border border-gray-200 rounded px-2 py-1 focus:outline-none focus:ring-1 focus:ring-blue-500" />
                              ) : <span>{part.quantity}</span>}
                            </td>
                            {['leather', 'fabric', 'core'].includes(section) && (
                              <>
                                <td className="p-2">
                                  {canEdit ? (
                                    <input type="number" value={part.width_cm || ''} onChange={e => updatePart(part._idx, { width_cm: e.target.value ? Number(e.target.value) : null })}
                                      step="0.1" placeholder="0.0" className="w-full border border-gray-200 rounded px-2 py-1 focus:outline-none focus:ring-1 focus:ring-blue-500" />
                                  ) : <span>{part.width_cm || '-'}</span>}
                                </td>
                                <td className="p-2">
                                  {canEdit ? (
                                    <input type="number" value={part.height_cm || ''} onChange={e => updatePart(part._idx, { height_cm: e.target.value ? Number(e.target.value) : null })}
                                      step="0.1" placeholder="0.0" className="w-full border border-gray-200 rounded px-2 py-1 focus:outline-none focus:ring-1 focus:ring-blue-500" />
                                  ) : <span>{part.height_cm || '-'}</span>}
                                </td>
                                <td className="p-2">
                                  <span className="font-medium text-blue-700">
                                    {part.ds_count ? part.ds_count.toFixed(1) : '-'}
                                  </span>
                                </td>
                                <td className="p-2">
                                  {canEdit ? (
                                    <input type="text" value={part.model_type} onChange={e => updatePart(part._idx, { model_type: e.target.value })}
                                      placeholder="本型" className="w-full border border-gray-200 rounded px-2 py-1 focus:outline-none focus:ring-1 focus:ring-blue-500" />
                                  ) : <span>{part.model_type}</span>}
                                </td>
                              </>
                            )}
                            <td className="p-2">
                              {canEdit ? (
                                <input type="text" value={part.spec} onChange={e => updatePart(part._idx, { spec: e.target.value })}
                                  placeholder="仕様・備考" className="w-full border border-gray-200 rounded px-2 py-1 focus:outline-none focus:ring-1 focus:ring-blue-500" />
                              ) : <span>{part.spec}</span>}
                            </td>
                            {canEdit && (
                              <td className="p-2">
                                <button onClick={() => removePart(part._idx)} className="text-gray-300 hover:text-red-500">
                                  <Trash2 className="h-3.5 w-3.5" />
                                </button>
                              </td>
                            )}
                          </tr>
                        ))}
                      </tbody>
                    </table>
                  </div>
                )}
                {canEdit && (
                  <div className="p-3">
                    <button onClick={() => addPart(section)} className="flex items-center gap-1 text-xs text-blue-600 hover:underline">
                      <Plus className="h-3.5 w-3.5" />{SECTION_LABELS[section]}を追加
                    </button>
                  </div>
                )}
              </div>
            )}
          </div>
        )
      })}

      {/* 注意事項 */}
      {(['production', 'inspection'] as const).map(noteType => {
        const typeNotes = notes.map((n, i) => ({ ...n, _idx: i })).filter(n => n.note_type === noteType)
        const label = noteType === 'production' ? '注意事項（生産時）' : '注意事項（検品時）'
        const color = noteType === 'production' ? 'bg-purple-50 border-purple-200' : 'bg-orange-50 border-orange-200'
        const isExpanded = expandedSections[noteType]
        return (
          <div key={noteType} className={`border rounded-xl overflow-hidden ${color}`}>
            <button onClick={() => setExpandedSections(p => ({ ...p, [noteType]: !p[noteType] }))}
              className="w-full flex items-center justify-between px-4 py-3 hover:opacity-80">
              <span className="text-sm font-bold text-gray-900">{label}（{typeNotes.length}件）</span>
              {isExpanded ? <ChevronUp className="h-4 w-4 text-gray-500" /> : <ChevronDown className="h-4 w-4 text-gray-500" />}
            </button>
            {isExpanded && (
              <div className="border-t border-gray-200 bg-white p-3 space-y-2">
                {typeNotes.map((note, i) => (
                  <div key={i} className="flex items-start gap-2">
                    <span className="text-xs text-gray-400 mt-2">・</span>
                    {canEdit ? (
                      <input type="text" value={note.content} onChange={e => updateNote(note._idx, e.target.value)}
                        placeholder="注意事項を入力" className="flex-1 text-xs border border-gray-200 rounded px-2 py-1.5 focus:outline-none focus:ring-1 focus:ring-blue-500" />
                    ) : <span className="text-xs text-gray-700">{note.content}</span>}
                    {canEdit && (
                      <button onClick={() => removeNote(note._idx)} className="text-gray-300 hover:text-red-500 mt-1">
                        <Trash2 className="h-3.5 w-3.5" />
                      </button>
                    )}
                  </div>
                ))}
                {canEdit && (
                  <button onClick={() => addNote(noteType)} className="flex items-center gap-1 text-xs text-blue-600 hover:underline">
                    <Plus className="h-3.5 w-3.5" />追加
                  </button>
                )}
              </div>
            )}
          </div>
        )
      })}
    </div>
  )
}
