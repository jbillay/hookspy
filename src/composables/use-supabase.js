import { createClient } from '@supabase/supabase-js'

let client = null

export function useSupabase() {
  if (!client) {
    const supabaseUrl = import.meta.env.VITE_SUPABASE_URL
    const supabaseAnonKey = import.meta.env.VITE_SUPABASE_ANON_KEY
    client = createClient(supabaseUrl, supabaseAnonKey)
  }
  return { client }
}
