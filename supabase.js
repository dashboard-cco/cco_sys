/* Supabase client - CCO */
(function iniciarSupabaseCCO(){
  const SUPABASE_URL = window.CCO_SUPABASE_URL || "https://oesgyirwppzquatrmijq.supabase.co";
  const SUPABASE_ANON_KEY = window.CCO_SUPABASE_ANON_KEY || "sb_publishable_QQxzbl5CMB1UorLZ9bQkOA_xGCrejmQ";
  if (!window.supabase || typeof window.supabase.createClient !== "function") {
    console.error("Biblioteca Supabase não carregou. Verifique a conexão/CDN.");
    return;
  }

  const supabaseClient = window.supabase.createClient(SUPABASE_URL, SUPABASE_ANON_KEY);
  window.supabaseClient = supabaseClient;
  window.banco = supabaseClient;
  console.log("Cliente Supabase criado com sucesso.");
})();
