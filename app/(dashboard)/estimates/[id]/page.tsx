import { notFound } from 'next/navigation'
import { createClient } from '@/lib/supabase/server'
import EstimateDetailClient from './EstimateDetailClient'
import type { EstimateStatus } from '@/lib/types/estimate'

export default async function EstimateDetailPage({
  params,
}: {
  params: Promise<{ id: string }>
}) {
  const { id } = await params
  const supabase = await createClient()

  const { data: est, error } = await supabase
    .from('estimates')
    .select('*, client:customers(name), items:estimate_items(*)')
    .eq('id', id)
    .order('sort_order', { referencedTable: 'estimate_items' })
    .single()

  if (error || !est) notFound()

  return (
    <EstimateDetailClient
      data={{
        id:             est.id,
        estimate_number: est.estimate_number,
        status:         est.status as EstimateStatus,
        client_name:    (est.client as { name?: string } | null)?.name ?? null,
        client_contact: est.client_contact,
        issue_date:     est.issue_date,
        expiry_date:    est.expiry_date,
        subject:        est.subject,
        delivery_date:  est.delivery_date,
        total_amount:   est.total_amount,
        tax_amount:     est.tax_amount,
        grand_total:    est.grand_total,
        payment_terms:  est.payment_terms,
        notes:          est.notes,
        items:          est.items ?? [],
      }}
    />
  )
}
