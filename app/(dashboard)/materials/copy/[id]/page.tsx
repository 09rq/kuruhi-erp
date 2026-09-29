import Link from 'next/link'
import { notFound } from 'next/navigation'
import { createClient } from '@/lib/supabase/server'
import MaterialForm from '../../MaterialForm'

export default async function MaterialCopyPage({
  params,
}: {
  params: Promise<{ id: string }>
}) {
  const { id } = await params
  const supabase = await createClient()

  const [{ data: material, error }, { data: suppliers }, { data: groups }] = await Promise.all([
    supabase.from('materials').select('*').eq('id', id).single(),
    supabase
      .from('customers')
      .select('id, name, type')
      .eq('is_active', true)
      .order('name', { ascending: true }),
    supabase
      .from('material_groups')
      .select('id, name, standard_price')
      .eq('is_active', true)
      .order('name'),
  ])

  if (error || !material) notFound()

  return (
    <div className="p-8">
      <div className="mb-6">
        <div className="flex items-center gap-2 text-sm text-gray-500 mb-2">
          <Link href="/materials" className="hover:text-gray-700">材料登録</Link>
          <span>/</span>
          <span className="text-gray-900">コピーして新規登録</span>
        </div>
        <h1 className="text-2xl font-bold text-gray-900">
          材料 コピーして新規登録
          <span className="ml-3 text-base font-normal text-gray-400">
            元：{material.name}（{material.code}）
          </span>
        </h1>
        <p className="mt-1 text-sm text-gray-500">
          品目コードは新規採番されます。内容を必要に応じて修正してください（色違いの登録などに便利です）。
        </p>
      </div>
      <MaterialForm copyFrom={material} suppliers={suppliers ?? []} groups={groups ?? []} />
    </div>
  )
}
