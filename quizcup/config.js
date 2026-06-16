/* ============================================================
   QUIZ CUP — Configuration
   ADMIN_API_SECRET must match the same env var set in Vercel.
   ============================================================ */

const CONFIG = {
  SUPABASE_URL:     'https://atbarairuttwamzihkxv.supabase.co',
  SUPABASE_KEY:     'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6ImF0YmFyYWlydXR0d2Ftemloa3h2Iiwicm9sZSI6ImFub24iLCJpYXQiOjE3ODE1NTc0OTQsImV4cCI6MjA5NzEzMzQ5NH0.zDYkPjBa5e-V5V27VZfCd2R5EZk3xiDPULKtStiY5Xo',
  ADMIN_PASSWORD:   'quizcup2024',
  /* Must match ADMIN_API_SECRET env var in Vercel dashboard */
  ADMIN_API_SECRET: 'CHANGE_ME_IN_VERCEL'
};
