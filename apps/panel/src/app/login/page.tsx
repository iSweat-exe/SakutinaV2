'use client'
import { createClient } from '@/lib/supabase'

export default function LoginPage() {
  const supabase = createClient()

  const handleLoginWithDiscord = async () => {
    await supabase.auth.signInWithOAuth({
      provider: 'discord',
      options: {
        redirectTo: `${window.location.origin}/auth/callback`,
      },
    })
  }

  return (
    <div className="flex h-screen items-center justify-center bg-zinc-950 text-white">
      <div className="text-center">
        <h1 className="text-3xl font-bold mb-4">Sign in to Sakutina Panel</h1>
        <button
          onClick={handleLoginWithDiscord}
          className="rounded bg-[#5865F2] px-6 py-3 font-semibold text-white hover:bg-[#4752C4] transition"
        >
          Sign in with Discord
        </button>
      </div>
    </div>
  )
}
