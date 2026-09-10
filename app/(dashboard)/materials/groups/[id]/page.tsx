import Link from 'next/link'
import { notFound } from 'next/navigation'
import { createClient } from '@/lib/supabase/server'
import MaterialGroupForm from '../MaterialGroupForm'
import GroupMembersPanel from './GroupMembersPanel'
import GroupDeleteButton from './GroupDeleteButton'

export default async function MaterialGroupDetailPage({
  params,
}: {
  params: Promise<{ id: string }>
}) {
  const { id } = await params
  const supabase = await createClient()

  const [{ data: group, error }, { data: suppliers }, { data: members }, { data: ungrouped }] = await Promise.all([
    supabase.from('material_groups').select('*').eq('id', id).single(),
    supabase.from('customers').select('id, name').eq('is_active', true).order('name'),
    supabase
      .from('materials')
      .select('id, code, name, color_cd, standard_price, price_overridden, current_stock, unit')
      .eq('group_id', id)
      .order('code'),
    supabase
      .from('materials')
      .select('id, code, name, color_cd')
      .is('group_id', null)
      .eq('is_active', true)
      .order('name'),
  ])

  if (error || !group) notFound()

  return (
    <div className="p-8">
      <div className="flex items-center justify-between mb-6">
        <div>
          <div className="flex items-center gap-2 text-sm text-gray-500 mb-2">
            <Link href="/materials" className="hover:text-gray-700">材料登録</Link>
            <span>/</span>
            <Link href="/materials/groups" className="hover:text-gray-700">材料グループ管理</Link>
            <span>/</span>
            <span className="text-gray-900">{group.name}</span>
          </div>
          <h1 className="text-2xl font-bold text-gray-900">{group.name}</h1>
        </div>
        <GroupDeleteButton id={group.id} name={group.name} />
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
        <div>
          <h2 className="text-sm font-semibold text-gray-700 mb-3">グループ情報</h2>
          <MaterialGroupForm group={group} suppliers={suppliers ?? []} />
        </div>
        <div>
          <h2 className="text-sm font-semibold text-gray-700 mb-3">所属している材料（色など）</h2>
          <GroupMembersPanel
            groupId={group.id}
            groupPrice={group.standard_price}
            members={members ?? []}
            candidates={ungrouped ?? []}
          />
        </div>
      </div>
    </div>
  )
}
