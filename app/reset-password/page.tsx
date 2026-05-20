'use client'

import { useState } from 'react'
import { createBrowserClient } from '@supabase/ssr'

export default function ResetPasswordPage() {
  const [email, setEmail] = useState('')
  const [sent, setSent] = useState(false)
  const [error, setError] = useState('')

  const supabase = createBrowserClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!
  )

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault()
    setError('')
    const { error } = await supabase.auth.resetPasswordForEmail(email, {
      redirectTo: 'https://kuruhi-erp.vercel.app/update-password',
    })
    if (error) {
      setError('送信に失敗しました。メールアドレスを確認してください。')
    } else {
      setSent(true)
    }
  }

  return (
    <div className="min-h-full flex flex-col items-center justify-center bg-gray-50">
      <div className="w-full max-w-md">
        <div className="text-center mb-8">
          <div
            className="inline-flex items-center justify-center w-16 h-16 rounded-2xl mb-4"
            style={{ backgroundColor: '#1F3864' }}
          >
            <span className="text-white text-2xl font-bold">K</span>
          </div>
          <h1 className="text-2xl font-bold text-gray-900">クルヒ ERP</h1>
          <p className="mt-1 text-sm text-gray-500">株式会社クルヒ 基幹システム</p>
        </div>

        <div className="bg-white rounded-2xl shadow-sm border border-gray-200 p-8">
          <h2 className="text-lg font-semibold text-gray-900 mb-6">パスワードリセット</h2>

          {sent ? (
            <div className="text-center">
              <p className="text-sm text-gray-700 mb-4">
                パスワードリセット用のメールを送信しました。<br />
                メールのリンクからパスワードを設定してください。
              </p>
              <a href="/login" className="text-sm text-[#1F3864] underline">ログインに戻る</a>
            </div>
          ) : (
            <form onSubmit={handleSubmit} className="space-y-5">
              {error && (
                <div className="p-3 rounded-lg bg-red-50 border border-red-200">
                  <p className="text-sm text-red-700">{error}</p>
                </div>
              )}
              <div>
                <label htmlFor="email" className="block text-sm font-medium text-gray-700 mb-1">
                  メールアドレス
                </label>
                <input
                  id="email"
                  type="email"
                  required
                  value={email}
                  onChange={e => setEmail(e.target.value)}
                  className="w-full px-3 py-2.5 rounded-lg border border-gray-300 text-sm outline-none focus:ring-2 focus:ring-[#1F3864] focus:border-[#1F3864] transition"
                  placeholder="example@kuruhi.co.jp"
                />
              </div>
              <button
                type="submit"
                className="w-full py-2.5 px-4 rounded-lg text-white text-sm font-semibold hover:opacity-90 transition-opacity"
                style={{ backgroundColor: '#1F3864' }}
              >
                リセットメールを送信
              </button>
              <div className="text-center">
                <a href="/login" className="text-sm text-gray-500 hover:text-gray-700 underline">ログインに戻る</a>
              </div>
            </form>
          )}
        </div>
      </div>
    </div>
  )
}
