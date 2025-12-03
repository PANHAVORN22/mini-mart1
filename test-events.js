// Quick test script to verify premium_events query
// Run this in browser console on the subscription page

const { createBrowserClient } = require('@supabase/ssr');

async function testEventsFetch() {
  const supabase = createBrowserClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL,
    process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY
  );

  console.log('Testing premium_events query...');

  const { data, error } = await supabase
    .from('premium_events')
    .select('*')
    .eq('audience', 'premium')
    .order('starts_at', { ascending: true });

  if (error) {
    console.error('ERROR:', error);
  } else {
    console.log('SUCCESS - Data:', data);
    console.log('Number of events:', data?.length);
  }
}

testEventsFetch();
