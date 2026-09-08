import Link from 'next/link'
import { createClient } from '@/lib/supabase/server'
import EstimateForm from '../EstimateForm'

export default async function EstimateNewPage() {
  const supabase = await createClient()

  const [
    { data: clients },
    { data: products },
    { data: generatedNo },
  ] = await Promise.all([
    supabase
      .from('customers')
      .select('id, name')
      .eq('type', 'customer')
      .eq('is_active', true)
      .order('name'),
    supabase
      .from('products')
      .select('id, name, selling_price, client_id, variants:product_variants(id, color_name, material, size_label)')
      .eq('status', 'active')
      .order('name'),
    supabase.rpc('generate_estimate_number'),
  ])

  const productOptions = (products ?? []).map((p) => ({
    id:            p.id,
    name:          p.name,
    selling_price: p.selling_price,
    client_id:     p.client_id,
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
          <span className="text-gray-900">新規作成</span>
        </div>
        <h1 className="text-2xl font-bold text-gray-900">見積書 新規作成</h1>
      </div>
      <EstimateForm
        clients={clients ?? []}
        products={productOptions}
        estimateNumber={generatedNo ?? ''}
      />
    </div>
  )
}
