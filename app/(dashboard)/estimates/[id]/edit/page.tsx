import Link from 'next/link'
import { notFound } from 'next/navigation'
import { createClient } from '@/lib/supabase/server'
import EstimateForm from '../../EstimateForm'

export default async function EstimateEditPage({
  params,
}: {
  params: Promise<{ id: string }>
}) {
  const { id } = await params
  const supabase = await createClient()

  const [
    estimateRes,
    { data: clients },
    { data: products },
  ] = await Promise.all([
    supabase
      .from('estimates')
      .select('*, items:estimate_items(*)')
      .eq('id', id)
      .order('sort_order', { referencedTable: 'estimate_items' })
      .single(),
    supabase
      .from('customers')
      .select('id, name')
      .eq('type', 'customer')
      .eq('is_active', true)
      .order('name'),
    supabase
      .from('products')
      .select('id, name, selling_price, variants:product_variants(id, color_name, material, size_label)')
      .eq('status', 'active')
      .order('name'),
  ])

  if (estimateRes.error || !estimateRes.data) notFound()
  const estimate = estimateRes.data

  const productOptions = (products ?? []).map((p) => ({
    id:            p.id,
    name:          p.name,
    selling_price: p.selling_price,
    variants: (p.variants as { id: string; color_name: string | null; material: string | null; size_label: string | null }[] ?? [])
      .map((v) => ({
        id:    v.id,
        label: [v.color_name, v.material, v.size_label].filter(Boolean).join(' / '),
      }))
      .filter((v) => v.label),
  }))

  return (
    <div className="pt-8 px-8 pb-0 flex flex-col flex-1">
      <div className="mb-6">
        <div className="flex items-center gap-2 text-sm text-gray-500 mb-2">
          <Link href="/estimates" className="hover:text-gray-700">御見積書</Link>
          <span>/</span>
          <Link href={`/estimates/${id}`} className="hover:text-gray-700">{estimate.estimate_number}</Link>
          <span>/</span>
          <span className="text-gray-900">編集</span>
        </div>
        <h1 className="text-2xl font-bold text-gray-900">
          見積書 編集
          <span className="ml-3 text-base font-mono font-normal text-gray-400">
            {estimate.estimate_number}
          </span>
        </h1>
      </div>
      <EstimateForm
        estimate={estimate}
        clients={clients ?? []}
        products={productOptions}
        estimateNumber={estimate.estimate_number}
      />
    </div>
  )
}
