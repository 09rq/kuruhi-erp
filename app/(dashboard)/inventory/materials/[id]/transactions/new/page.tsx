import { notFound } from 'next/navigation'
import { createClient } from '@/lib/supabase/server'
import TransactionForm from '../TransactionForm'

export default async function NewMaterialTransactionPage({
  params,
}: {
  params: Promise<{ id: string }>
}) {
  const { id } = await params
  const supabase = await createClient()

  const { data: material } = await supabase
    .from('materials')
    .select('id, name, unit')
    .eq('id', id)
    .single()

  if (!material) notFound()

  return (
    <div className="p-8">
      <div className="mb-6">
        <h1 className="text-2xl font-bold text-gray-900">入出庫登録</h1>
        <p className="mt-1 text-sm text-gray-500">{material.name}</p>
      </div>
      <TransactionForm
        materialId={material.id}
        materialName={material.name}
        unit={material.unit}
      />
    </div>
  )
}
