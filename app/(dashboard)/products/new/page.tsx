import Link from 'next/link'
import { createClient } from '@/lib/supabase/server'
import ProductForm from '../ProductForm'

export default async function ProductNewPage() {
  const supabase = await createClient()

  const [
    { data: categories },
    { data: clients },
    { data: materials },
    { data: vendors },
    { data: suppliers },
    { data: generatedNo },
    { data: brands },
  ] = await Promise.all([
    supabase
      .from('product_categories')
      .select('id, name, sort_order, is_active')
      .eq('is_active', true)
      .order('sort_order'),
    supabase
      .from('customers')
      .select('id, name')
      .eq('type', 'customer')
      .eq('is_active', true)
      .order('name'),
    supabase
      .from('materials')
      .select('id, name, code, standard_price, category, unit, short_name, group_id, supplier:customers(short_name)')
      .eq('is_active', true)
      .order('name'),
    supabase
      .from('customers')
      .select('id, name, short_name')
      .eq('type', 'vendor_processing')
      .eq('is_active', true)
      .order('short_name'),
    supabase
      .from('customers')
      .select('id, name, short_name')
      .eq('type', 'vendor_material')
      .eq('is_active', true)
      .order('short_name'),
    supabase.rpc('generate_product_no'),
    supabase.from('brands').select('id, name').order('name'),
  ])

  // 材料オプションの正規化（supplier は join 結果）
  const materialOptions = (materials ?? []).map((m) => {
    const sup = Array.isArray(m.supplier) ? m.supplier[0] : m.supplier
    return {
      id:                  m.id,
      name:                m.name,
      code:                m.code,
      standard_price:      m.standard_price,
      category:            m.category ?? undefined,
      unit:                m.unit ?? null,
      short_name:          m.short_name ?? null,
      group_id:            m.group_id ?? null,
      supplier_short_name: (sup as { short_name?: string } | null)?.short_name ?? null,
    }
  })

  return (
    <div className="pt-8 px-8 pb-0 flex flex-col flex-1">
      <div className="mb-6">
        <div className="flex items-center gap-2 text-sm text-gray-500 mb-2">
          <Link href="/products" className="hover:text-gray-700">製品マスタ</Link>
          <span>/</span>
          <span className="text-gray-900">新規登録</span>
        </div>
        <h1 className="text-2xl font-bold text-gray-900">製品 新規登録</h1>
      </div>
      <ProductForm
        categories={categories ?? []}
        clients={clients ?? []}
        materialOptions={materialOptions}
        vendors={vendors ?? []}
        supplierOptions={suppliers ?? []}
        brands={brands ?? []}
        initialProductNo={generatedNo ?? ''}
      />
    </div>
  )
}
