import { createClient } from '@/lib/supabase/server'
import CompanyForm from './CompanyForm'

export default async function CompanyPage() {
  const supabase = await createClient()
  const { data: company } = await supabase
    .from('company_info')
    .select('*')
    .limit(1)
    .maybeSingle()

  return <CompanyForm company={company} />
}
