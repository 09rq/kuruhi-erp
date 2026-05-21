import { login } from './actions'

export default async function LoginPage({
  searchParams,
}: {
  searchParams: Promise<{ error?: string }>
}) {
  const { error } = await searchParams

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
          <h2 className="text-lg font-semibold text-gray-900 mb-6">ログイン</h2>

          {error && (
            <div className="mb-4 p-3 rounded-lg bg-red-50 border border-red-200">
              <p className="text-sm text-red-700">
                {error === 'Invalid login credentials'
                  ? 'メールアドレスまたはパスワードが正しくありません'
                  : 'ログインに失敗しました。もう一度お試しください'}
              </p>
            </div>
          )}

          <form action={login} className="space-y-5">
            <div>
              <label htmlFor="email" className="block text-sm font-medium text-gray-700 mb-1">
                メールアドレス
              </label>
              <input
                id="email"
                name="email"
                type="email"
                autoComplete="email"
                required
                className="w-full px-3 py-2.5 rounded-lg border border-gray-300 text-sm outline-none focus:ring-2 focus:ring-[#1F3864] focus:border-[#1F3864] transition"
                placeholder="example@kuruhi.co.jp"
              />
            </div>

            <div>
              <label htmlFor="password" className="block text-sm font-medium text-gray-700 mb-1">
                パスワード
              </label>
              <input
                id="password"
                name="password"
                type="password"
                autoComplete="current-password"
                required
                className="w-full px-3 py-2.5 rounded-lg border border-gray-300 text-sm outline-none focus:ring-2 focus:ring-[#1F3864] focus:border-[#1F3864] transition"
                placeholder="••••••••"
              />
            </div>

            <button
              type="submit"
              className="w-full py-2.5 px-4 rounded-lg text-white text-sm font-semibold hover:opacity-90 active:opacity-80 transition-opacity"
              style={{ backgroundColor: '#1F3864' }}
            >
              ログイン
            </button>
          </form>

          <div className="mt-4 text-center">
            <a href="/reset-password" className="text-sm text-gray-500 hover:text-gray-700 underline">
              パスワードをお忘れですか？
            </a>
          </div>
        </div>

        <p className="mt-6 text-center text-xs text-gray-400">
          © 2026 株式会社クルヒ. All rights reserved.
        </p>
      </div>
    </div>
  )
}
