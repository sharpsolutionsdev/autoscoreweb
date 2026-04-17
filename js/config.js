/* Central Supabase config.
   This file centralizes SUPABASE_URL and SUPABASE_KEY for the frontend.
   To override locally create `js/config.local.js` that sets `window.SUPABASE_URL` / `window.SUPABASE_KEY`.
*/
(function () {
    if (typeof window === 'undefined') return;
    // Defaults (project values copied from existing pages). Replace if you rotate keys.
    window.SUPABASE_URL = window.SUPABASE_URL || 'https://poyjykgqsvgimssbhsuz.supabase.co';
    window.SUPABASE_KEY = window.SUPABASE_KEY || 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6InBveWp5a2dxc3ZnaW1zc2Joc3V6Iiwicm9sZSI6ImFub24iLCJpYXQiOjE3NzM4MjgyMzQsImV4cCI6MjA4OTQwNDIzNH0.1_KBIagUj_EkfTU2MF3qsyR1lvJQ4jVqZ2AuVcGDBIA';

    // Helper: expose a simple getter if needed
    window.getDVConfig = window.getDVConfig || function () {
        return { SUPABASE_URL: window.SUPABASE_URL, SUPABASE_KEY: window.SUPABASE_KEY };
    };
})();
