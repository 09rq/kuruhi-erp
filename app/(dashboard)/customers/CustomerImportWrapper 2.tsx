'use client'

import { useRouter } from 'next/navigation'
import CustomerImportButton from './CustomerImportButton'

export default function CustomerImportWrapper() {
  const router = useRouter()
  return <CustomerImportButton onImported={() => router.refresh()} />
}
