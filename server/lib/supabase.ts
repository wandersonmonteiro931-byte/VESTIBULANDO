import { createClient } from '@supabase/supabase-js';

const supabaseUrl = process.env.VITE_SUPABASE_URL;
const supabaseServiceKey = process.env.SUPABASE_SERVICE_ROLE_KEY;

if (!supabaseUrl || !supabaseServiceKey) {
  console.warn('⚠️ Credenciais do Supabase não configuradas');
  console.warn('VITE_SUPABASE_URL presente:', !!supabaseUrl);
  console.warn('SUPABASE_SERVICE_ROLE_KEY presente:', !!supabaseServiceKey);
}

export const supabaseAdmin = createClient(supabaseUrl || '', supabaseServiceKey || '', {
  auth: {
    autoRefreshToken: false,
    persistSession: false,
  },
});

export { supabaseUrl };
