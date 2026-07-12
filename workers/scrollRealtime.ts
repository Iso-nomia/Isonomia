// workers/scrollRealtime.ts
import { createClient }  from '@supabase/supabase-js';
import { Queue }         from 'bullmq';
import { connection }    from '@/lib/queue';        // ✅ BullMQ-safe

// ----- Supabase ------------------------------------------------------------
const supabaseUrl  = process.env.NEXT_PUBLIC_SUPABASE_URL!;
const supabaseKey  =
  process.env.SUPABASE_SERVICE_ROLE_KEY ??
  process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY;

if (!supabaseUrl || !supabaseKey) {
  throw new Error('Missing Supabase URL or key in env');
}

const supabase = createClient(supabaseUrl, supabaseKey, {
  auth: { persistSession: false },
});

// ----- Queue ---------------------------------------------------------------
const cfQueue = new Queue('scrollEvents', { connection });

// ----- Subscribe to realtime inserts --------------------------------------
(async () => {
  try {
    await supabase
      .channel('user_behavior')
      .on(
        'postgres_changes',
        { event: 'INSERT', schema: 'public', table: 'scroll_events' },
        async payload => {
          await cfQueue.add(
            'forward',
            payload.new,
            { removeOnComplete: true, removeOnFail: true }
          );
        },
      )
      .subscribe(); // returns Promise<RealtimeChannel>

    console.log('[scrollRealtime] listening for scroll_events inserts…');
  } catch (err) {
    console.error('[scrollRealtime] subscription failed:', err);
    process.exit(1);   // optional: crash so nodemon restarts
  }
})();
