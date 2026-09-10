import Link from 'next/link'
import { createClient } from '@/lib/supabase/server'

export default async function MaterialGroupsPage() {
  const supabase = await createClient()

  const [{ data: groups }, { data: materials }] = await Promise.all([
    supabase.from('material_groups').select('*').order('name'),
    supabase.from('materials').select('id, group_id'),
  ])

  const memberCount: Record<string, number> = {}
  for (const m of materials ?? []) {
    if (m.group_id) memberCount[m.group_id] = (memberCount[m.group_id] ?? 0) + 1
  }

  return (
    <div className="p-8">
      <div className="flex items-center justify-between mb-6">
        <div>
          <div className="flex items-center gap-2 text-sm text-gray-500 mb-2">
            <Link href="/materials" className="hover:text-gray-700">材料登録</Link>
            <span>/</span>
            <span className="text-gray-900">材料グループ管理</span>
          </div>
          <h1 className="text-2xl font-bold text-gray-900">材料グループ管理</h1>
          <p className="mt-1 text-sm text-gray-500">
            色違いなど、同じ材料の複数バリエーションをまとめて単価を一元管理できます。
          </p>
        </div>
        <Link
          href="/materials/groups/new"
          className="inline-flex items-center gap-2 px-4 py-2 rounded-lg text-sm font-medium text-white"
          style={{ backgroundColor: '#1F3864' }}
        >
          ＋ 新規グループ作成
        </Link>
      </div>

      <div className="bg-white border border-gray-200 rounded-2xl overflow-hidden">
        <table className="w-full text-sm">
          <thead className="bg-gray-50 border-b border-gray-200">
            <tr>
              <th className="text-left px-4 py-2.5 font-medium text-gray-600">グループ名</th>
              <th className="text-left px-4 py-2.5 font-medium text-gray-600">区分</th>
              <th className="text-right px-4 py-2.5 font-medium text-gray-600">単価</th>
              <th className="text-right px-4 py-2.5 font-medium text-gray-600">所属材料数</th>
              <th className="text-left px-4 py-2.5 font-medium text-gray-600">状態</th>
            </tr>
          </thead>
          <tbody className="divide-y divide-gray-100">
            {(groups ?? []).map((g) => (
              <tr key={g.id} className="hover:bg-gray-50">
                <td className="px-4 py-3">
                  <Link href={`/materials/groups/${g.id}`} className="font-medium text-blue-600 hover:underline">
                    {g.name}
                  </Link>
                </td>
                <td className="px-4 py-3 text-gray-600">{g.category || '—'}</td>
                <td className="px-4 py-3 text-right text-gray-800">
                  {g.standard_price !== null ? `${Number(g.standard_price).toLocaleString()}円` : '—'}
                </td>
                <td className="px-4 py-3 text-right text-gray-600">{memberCount[g.id] ?? 0}件</td>
                <td className="px-4 py-3">
                  <span className={`text-xs px-2 py-0.5 rounded-full ${g.is_active ? 'bg-green-100 text-green-700' : 'bg-gray-100 text-gray-500'}`}>
                    {g.is_active ? '有効' : '無効'}
                  </span>
                </td>
              </tr>
            ))}
            {(!groups || groups.length === 0) && (
              <tr>
                <td colSpan={5} className="px-4 py-12 text-center text-gray-400">
                  まだ材料グループが登録されていません
                </td>
              </tr>
            )}
          </tbody>
        </table>
      </div>
    </div>
  )
}
