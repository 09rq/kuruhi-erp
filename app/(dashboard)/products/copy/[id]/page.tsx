import Link from 'next/link'
import { notFound } from 'next/navigation'
import { createClient } from '@/lib/supabase/server'
import ProductForm from '../../ProductForm'

export default async function ProductCopyPage({
  params,
}: {
  params: Promise<{ id: string }>
}) {
  const { id } = await params
  const supabase = await createClient()

  const [
    { data: product },
    { data: variants },
    { data: costItems },
    { data: categories },
    { data: clients },
    { data: materials },
    { data: vendors },
    { data: suppliers },
    { data: generatedNo },
    { data: brands },
  ] = await Promise.all([
    supabase.from('products').select('*').eq('id', id).single(),
    supabase.from('product_variants').select('*').eq('product_id', id).order('sort_order'),
    supabase
      .from('product_cost_items')
      .select('*')
      .eq('product_id', id)
      .order('sort_order'),
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
      .select('id, name, code, standard_price, category, unit, short_name, supplier:customers(short_name)')
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

  if (!product) notFound()

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
      supplier_short_name: (sup as { short_name?: string } | null)?.short_name ?? null,
    }
  })

  return (
    <div className="pt-8 px-8 pb-0 flex flex-col flex-1">
      <div className="mb-6">
        <div className="flex items-center gap-2 text-sm text-gray-500 mb-2">
          <Link href="/products" className="hover:text-gray-700">製品マスタ</Link>
          <span>/</span>
          <Link href={`/products/${id}`} className="hover:text-gray-700">{product.product_no}</Link>
          <span>/</span>
          <span className="text-gray-900">コピーして新規作成</span>
        </div>
        <h1 className="text-2xl font-bold text-gray-900">
          製品コピー
          <span className="ml-3 text-base font-normal text-gray-400">{product.product_no} — {product.name}</span>
        </h1>
      </div>
      <ProductForm
        copyFrom={product}
        variants={variants ?? []}
        costItems={costItems ?? []}
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
