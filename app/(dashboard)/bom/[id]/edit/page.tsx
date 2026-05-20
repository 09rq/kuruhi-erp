'use client'

import { useEffect, useState } from 'react'
import { useParams } from 'next/navigation'
import Link from 'next/link'
import { createClient } from '@/lib/supabase/client'
import BomForm from '../../BomForm'
import type { Bom, BomItem } from '@/lib/types/bom'

interface ProductOption  { id: string; product_no: string; name: string; cost_confirmed: boolean }
interface VariantOption  { id: string; product_id: string; color_name: string | null; size_label: string | null }
interface MaterialOption {
  id: string; name: string; code: string
  unit: string | null; standard_price: number | null
  category: string | null
}

export default function BomEditPage() {
  const params    = useParams()
  const id        = params.id as string

  const [loading,   setLoading]   = useState(true)
  const [notFound,  setNotFound]  = useState(false)
  const [title,     setTitle]     = useState('BOM')
  const [bom,       setBom]       = useState<Bom | null>(null)
  const [bomItems,  setBomItems]  = useState<BomItem[]>([])
  const [products,  setProducts]  = useState<ProductOption[]>([])
  const [variants,  setVariants]  = useState<VariantOption[]>([])
  const [materials, setMaterials] = useState<MaterialOption[]>([])

  useEffect(() => {
    if (!id) return
    const supabase = createClient()

    Promise.all([
      supabase.from('boms').select('*').eq('id', id).single(),
      supabase.from('bom_items').select('*').eq('bom_id', id).order('sort_order'),
      supabase.from('products').select('id, product_no, name, cost_confirmed').neq('status', 'discontinued').order('product_no'),
      supabase.from('product_variants').select('id, product_id, color_name, size_label').eq('status', 'active').order('sort_order'),
      supabase.from('materials').select('id, name, code, unit, standard_price, category').eq('is_active', true).order('name'),
    ]).then(([bomRes, itemsRes, productsRes, variantsRes, materialsRes]) => {
      if (bomRes.error || !bomRes.data) {
        setNotFound(true)
        setLoading(false)
        return
      }
      const bomData = bomRes.data
      const prods   = productsRes.data ?? []
      const match   = prods.find((p) => p.id === bomData.product_id)

      setBom(bomData)
      setBomItems(itemsRes.data ?? [])
      setProducts(prods)
      setVariants(variantsRes.data ?? [])
      setMaterials(materialsRes.data ?? [])
      setTitle(match ? `${match.product_no} — ${match.name}` : 'BOM')
      setLoading(false)
    })
  }, [id])

  if (loading) {
    return (
      <div className="pt-8 px-8 flex items-center justify-center flex-1">
        <span className="text-sm text-gray-400">読み込み中...</span>
      </div>
    )
  }

  if (notFound || !bom) {
    return (
      <div className="pt-8 px-8 flex items-center justify-center flex-1">
        <span className="text-sm text-red-500">BOM が見つかりませんでした</span>
      </div>
    )
  }

  return (
    <div className="pt-8 px-8 pb-0 flex flex-col flex-1">
      <div className="mb-6">
        <div className="flex items-center gap-2 text-sm text-gray-500 mb-2">
          <Link href="/bom" className="hover:text-gray-700">BOM・部品表</Link>
          <span>/</span>
          <Link href={`/bom/${id}`} className="hover:text-gray-700">{title}</Link>
          <span>/</span>
          <span className="text-gray-900">編集</span>
        </div>
        <h1 className="text-2xl font-bold text-gray-900">BOM 編集</h1>
      </div>
      <BomForm
        bom={bom}
        bomItems={bomItems}
        products={products}
        variants={variants}
        materials={materials}
      />
    </div>
  )
}
