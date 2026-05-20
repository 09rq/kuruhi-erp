import type { Metadata } from 'next'
import './globals.css'

export const metadata: Metadata = {
  title: 'クルヒ ERP',
  description: '株式会社クルヒ 基幹システム',
}

export default function RootLayout({
  children,
}: {
  children: React.ReactNode
}) {
  return (
    <html lang="ja" className="h-full">
      <body className="h-full bg-white text-gray-900 antialiased">
        {children}
      </body>
    </html>
  )
}
