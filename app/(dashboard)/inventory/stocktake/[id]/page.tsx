import { createClient } from '@/lib/supabase/server'
import { notFound } from 'next/navigation'
import StocktakeDetailClient from './StocktakeDetailClient'

export default async function StocktakeDetailPage({
  params,
}: {
  params: Promise<{ id: string }>
}) {
  const { id } = await params
  const supabase = await createClient()

  const { data: stocktake } = await supabase
    .from('stocktakes')
    .select('*')
    .eq('id', id)
    .single()

  if (!stocktake) notFound()

  const [
    { data: materials },
    { data: wip },
    { data: products },
  ] = await Promise.all([
    supabase
      .from('stocktake_materials')
      .select('*, materials(name, code, unit)')
      .eq('stocktake_id', id)
      .order('created_at'),
    supabase
      .from('stocktake_wip')
      .select('*, production_lots(lot_number, planned_quantity, products(name))')
      .eq('stocktake_id', id)
      .order('created_at'),
    supabase
      .from('stocktake_products')
      .select('*, products(name, code), product_variants(name)')
      .eq('stocktake_id', id)
      .order('created_at'),
  ])

  return (
    <StocktakeDetailClient
      stocktake={stocktake}
      materials={materials || []}
      wip={wip || []}
      products={products || []}
    />
  )
}
