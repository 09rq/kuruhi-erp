import Link from 'next/link'
import { notFound } from 'next/navigation'
import { createClient } from '@/lib/supabase/server'
import MaterialForm from '../../MaterialForm'

export default async function MaterialEditPage({
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
          <span className="text-gray-900">編集</span>
        </div>
        <h1 className="text-2xl font-bold text-gray-900">
          {material.name}
          <span className="ml-3 text-base font-mono font-normal text-gray-400">
            {material.code}
          </span>
        </h1>
      </div>
      <MaterialForm material={material} suppliers={suppliers ?? []} groups={groups ?? []} />
    </div>
  )
}
