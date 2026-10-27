import { createClient } from '@supabase/supabase-js'
import type { Database } from './database.types.ts'
import { env } from './env.ts'

export const supabase = createClient<Database>(
  env.VITE_SUPABASE_URL,
  env.VITE_SUPABASE_PUBLISHABLE_KEY,
)
