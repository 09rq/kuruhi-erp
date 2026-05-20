'use client'

import { useRouter } from 'next/navigation'
import MaterialImportButton from './MaterialImportButton'

export default function MaterialImportWrapper() {
  const router = useRouter()
  return <MaterialImportButton onImported={() => router.refresh()} />
}
