import Link from 'next/link'
import { createClient } from '@/lib/supabase/server'
import { Plus, ClipboardList } from 'lucide-react'

const STATUS_LABELS = {
  draft: '下書き',
  in_progress: '実施中',
  completed: '完了',
}

const STATUS_COLORS = {
  draft: 'bg-gray-100 text-gray-700',
  in_progress: 'bg-blue-100 text-blue-700',
  completed: 'bg-green-100 text-green-700',
}

export default async function StocktakePage() {
  const supabase = await createClient()
  const { data: stocktakes } = await supabase
    .from('stocktakes')
    .select('*')
    .order('year_month', { ascending: false })

  return (
    <div className="p-6 max-w-5xl mx-auto">
      <div className="flex items-center justify-between mb-6">
        <div className="flex items-center gap-3">
          <div className="p-2 bg-blue-100 rounded-lg">
            <ClipboardList className="h-6 w-6 text-blue-700" />
          </div>
          <div>
            <h1 className="text-xl font-bold text-gray-900">棚卸管理</h1>
            <p className="text-sm text-gray-500">月次棚卸の作成・管理</p>
          </div>
        </div>
        <Link
          href="/inventory/stocktake/new"
          className="flex items-center gap-2 px-4 py-2 rounded-lg text-white text-sm font-medium"
          style={{ backgroundColor: '#1F3864' }}
        >
          <Plus className="h-4 w-4" />
          新規棚卸作成
        </Link>
      </div>

      <div className="bg-white border border-gray-200 rounded-xl overflow-hidden">
        {!stocktakes || stocktakes.length === 0 ? (
          <div className="text-center py-16 text-gray-400">
            <ClipboardList className="h-12 w-12 mx-auto mb-3 opacity-30" />
            <p>棚卸データがありません</p>
            <p className="text-sm mt-1">「新規棚卸作成」から開始してください</p>
          </div>
        ) : (
          <table className="w-full">
            <thead className="bg-gray-50 border-b border-gray-200">
              <tr>
                <th className="text-left text-xs font-medium text-gray-500 uppercase px-4 py-3">対象年月</th>
                <th className="text-left text-xs font-medium text-gray-500 uppercase px-4 py-3">ステータス</th>
                <th className="text-left text-xs font-medium text-gray-500 uppercase px-4 py-3">作成日</th>
                <th className="text-left text-xs font-medium text-gray-500 uppercase px-4 py-3">操作</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-gray-100">
              {stocktakes.map(s => (
                <tr key={s.id} className="hover:bg-gray-50">
                  <td className="px-4 py-3 font-medium text-gray-900">{s.year_month}</td>
                  <td className="px-4 py-3">
                    <span className={`inline-block text-xs font-medium px-2.5 py-1 rounded-full ${STATUS_COLORS[s.status as keyof typeof STATUS_COLORS]}`}>
                      {STATUS_LABELS[s.status as keyof typeof STATUS_LABELS]}
                    </span>
                  </td>
                  <td className="px-4 py-3 text-sm text-gray-500">
                    {new Date(s.created_at).toLocaleDateString('ja-JP')}
                  </td>
                  <td className="px-4 py-3">
                    <Link
                      href={`/inventory/stocktake/${s.id}`}
                      className="text-sm text-blue-600 hover:text-blue-800 font-medium"
                    >
                      詳細・入力
                    </Link>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        )}
      </div>
    </div>
  )
}
