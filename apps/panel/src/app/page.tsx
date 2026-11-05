'use client'

import { useEffect, useState } from 'react'
import { createClient } from '@/lib/supabase'
import type { User } from '@supabase/supabase-js'
import { Logout, Login } from '@getpapillon/papicons';

export default function Home() {
  const [user, setUser] = useState<User | null>(null)
  const [loading, setLoading] = useState(true)
  const supabase = createClient()

  useEffect(() => {
    async function loadSession() {
      const { data: { user } } = await supabase.auth.getUser()
      setUser(user)
      setLoading(false)
    }

    loadSession()

    const { data: { subscription } } = supabase.auth.onAuthStateChange((_event, session) => {
      setUser(session?.user ?? null)
      setLoading(false)
    })

    return () => subscription.unsubscribe()
  }, [supabase])

  const handleLoginWithDiscord = async () => {
    await supabase.auth.signInWithOAuth({
      provider: 'discord',
      options: {
        redirectTo: `${window.location.origin}/auth/callback`,
      },
    })
  }

  const handleLogout = async () => {
    await supabase.auth.signOut()
    setUser(null)
  }

  if (loading) {
    return (
      <div className="flex min-h-screen items-center justify-center bg-zinc-950 text-zinc-400 font-sans">
        Loading...
      </div>
    )
  }

  return (
    <div className="flex min-h-screen flex-col items-center justify-center bg-zinc-950 text-zinc-50 font-sans selection:bg-indigo-500 selection:text-white">
      <div className="w-full max-w-md p-8 rounded-2xl bg-zinc-900/50 border border-zinc-800 backdrop-blur-xl shadow-2xl flex flex-col items-center text-center">
        
        {user ? (
          <>
            <h1 className="text-2xl font-bold tracking-tight text-white mb-6">
              Welcome <span className="text-indigo-400">
                {user.user_metadata?.custom_claims?.global_name ?? user.user_metadata?.global_name ?? user.user_metadata?.full_name ?? 'User'}
              </span>
            </h1>

            <button
              onClick={handleLogout}
              className="w-full flex items-center justify-center gap-2.5 rounded-xl bg-red-600/10 border border-red-500/20 px-5 py-3.5 font-medium text-red-400 hover:bg-red-600 hover:text-white active:scale-[0.98] transition-all duration-200"
            >
              <Logout size={20} />
              Sign out
            </button>
          </>
        ) : (
          <>
            <div className="mb-8">
              <h1 className="text-3xl font-bold tracking-tight text-white">
                Sakutina Panel
              </h1>
              <p className="text-sm text-zinc-400 mt-2">
                Sign in with Discord to manage your bot and server.
              </p>
            </div>

            <button
              onClick={handleLoginWithDiscord}
              className="w-full flex items-center justify-center gap-3 rounded-xl bg-[#5865F2] px-5 py-3.5 font-medium text-white shadow-lg shadow-[#5865F2]/20 hover:bg-[#4752C4] active:scale-[0.98] transition-all duration-200"
            >
              <Login size={20} />
              Sign in with Discord
            </button>
          </>
        )}

        <p className="mt-8 text-xs text-zinc-500">
          Built by @iSweat-exe
        </p>

      </div>
    </div>
  )
}
