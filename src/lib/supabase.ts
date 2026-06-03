import { createClient } from '@supabase/supabase-js'

const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL!
const supabaseAnonKey = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!

// Client public (lecture seule côté client)
export const supabase = createClient(supabaseUrl, supabaseAnonKey)

// Client service_role (écriture, côté serveur uniquement)
// On passe cache:'no-store' sur chaque fetch pour court-circuiter
// le cache interne de Next.js 14 qui intercepte tous les appels fetch
export function getServiceClient() {
  const serviceKey = process.env.SUPABASE_SERVICE_ROLE_KEY!
  return createClient(supabaseUrl, serviceKey, {
    auth: { autoRefreshToken: false, persistSession: false },
    global: {
      fetch: (url: RequestInfo | URL, options?: RequestInit) =>
        fetch(url, { ...options, cache: 'no-store' }),
    },
  })
}
