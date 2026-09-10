import Link from 'next/link'
import { createClient } from '@/lib/supabase/server'
import MaterialGroupForm from '../MaterialGroupForm'

export default async function MaterialGroupNewPage() {
  const supabase = await createClient()
  const { data: suppliers } = await supabase
    .from('customers')
    .select('id, name')
    .eq('is_active', true)
    .order('name')

  return (
    <div className="p-8">
      <div className="mb-6">
        <div className="flex items-center gap-2 text-sm text-gray-500 mb-2">
          <Link href="/materials" className="hover:text-gray-700">材料登録</Link>
          <span>/</span>
          <Link href="/materials/groups" className="hover:text-gray-700">材料グループ管理</Link>
          <span>/</span>
          <span className="text-gray-900">新規作成</span>
        </div>
        <h1 className="text-2xl font-bold text-gray-900">材料グループ 新規作成</h1>
      </div>
      <MaterialGroupForm suppliers={suppliers ?? []} />
    </div>
  )
}
