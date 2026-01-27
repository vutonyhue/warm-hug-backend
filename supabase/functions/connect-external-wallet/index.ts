import { createClient } from "npm:@supabase/supabase-js@2";
import { verifyMessage } from "https://cdn.jsdelivr.net/npm/ethers@6.13.4/+esm";

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
};

Deno.serve(async (req) => {
  // Handle CORS preflight
  if (req.method === 'OPTIONS') {
    return new Response(null, { headers: corsHeaders });
  }

  try {
    // 1. Verify JWT token
    const authHeader = req.headers.get('Authorization');
    if (!authHeader) {
      console.error('[CONNECT-WALLET] Missing authorization header');
      return new Response(
        JSON.stringify({ success: false, error: 'Unauthorized' }),
        { status: 401, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
    }

    // 2. Create client with anon key to verify user
    const supabaseUrl = Deno.env.get('SUPABASE_URL')!;
    const supabaseAnonKey = Deno.env.get('SUPABASE_ANON_KEY')!;
    const supabaseUser = createClient(supabaseUrl, supabaseAnonKey, {
      global: { headers: { Authorization: authHeader } }
    });
    
    const { data: { user }, error: userError } = await supabaseUser.auth.getUser();
    if (userError || !user) {
      console.error('[CONNECT-WALLET] Unauthorized:', userError?.message);
      return new Response(
        JSON.stringify({ success: false, error: 'Unauthorized' }),
        { status: 401, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
    }

    // 3. Parse request body
    const { wallet_address, signature, message } = await req.json();
    
    if (!wallet_address || !signature || !message) {
      return new Response(
        JSON.stringify({ success: false, error: 'Missing required fields: wallet_address, signature, message' }),
        { status: 400, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
    }

    const normalizedAddress = wallet_address.toLowerCase();
    console.log(`[CONNECT-WALLET] Request for user: ${user.id}, wallet: ${normalizedAddress}`);

    // 4. Verify signature using ethers.js
    try {
      const recoveredAddress = verifyMessage(message, signature) as string;
      if (!recoveredAddress || recoveredAddress.toLowerCase() !== normalizedAddress) {
        console.warn('[CONNECT-WALLET] Signature verification failed');
        return new Response(
          JSON.stringify({ success: false, error: 'Invalid signature' }),
          { status: 401, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
        );
      }
    } catch (verifyError) {
      console.error('[CONNECT-WALLET] Signature verification error:', verifyError);
      return new Response(
        JSON.stringify({ success: false, error: 'Invalid signature format' }),
        { status: 401, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
    }

    console.log('[CONNECT-WALLET] Signature verified');

    // 5. Create Supabase client with service role for privileged operations
    const supabaseServiceKey = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!;
    const supabase = createClient(supabaseUrl, supabaseServiceKey);

    // 6. Check if wallet already belongs to another user
    const { data: existingProfile } = await supabase
      .from('profiles')
      .select('id')
      .eq('external_wallet_address', normalizedAddress)
      .neq('id', user.id)
      .maybeSingle();

    if (existingProfile) {
      console.warn('[CONNECT-WALLET] Wallet already connected to another account');
      return new Response(
        JSON.stringify({ success: false, error: 'Wallet already connected to another account' }),
        { status: 409, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
    }

    // Also check legacy wallet_address field
    const { data: legacyProfile } = await supabase
      .from('profiles')
      .select('id')
      .eq('wallet_address', normalizedAddress)
      .neq('id', user.id)
      .maybeSingle();

    if (legacyProfile) {
      console.warn('[CONNECT-WALLET] Wallet already connected to another account (legacy)');
      return new Response(
        JSON.stringify({ success: false, error: 'Wallet already connected to another account' }),
        { status: 409, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
    }

    // 7. Check if wallet is blacklisted
    const { data: blacklisted } = await supabase
      .from('blacklisted_wallets')
      .select('id, reason')
      .eq('wallet_address', normalizedAddress)
      .maybeSingle();

    if (blacklisted) {
      console.warn('[CONNECT-WALLET] Wallet blacklisted:', blacklisted.reason);
      return new Response(
        JSON.stringify({ success: false, error: 'This wallet has been blacklisted' }),
        { status: 403, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
    }

    // 8. Update profile with external wallet address
    // Note: We don't change default_wallet_type - user keeps their current default
    const { error: updateError } = await supabase
      .from('profiles')
      .update({
        external_wallet_address: normalizedAddress,
        wallet_address: normalizedAddress, // backward compatible
      })
      .eq('id', user.id);

    if (updateError) {
      console.error('[CONNECT-WALLET] Failed to update profile:', updateError);
      return new Response(
        JSON.stringify({ success: false, error: 'Failed to connect wallet' }),
        { status: 500, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
    }

    console.log('[CONNECT-WALLET] External wallet connected successfully:', normalizedAddress);

    return new Response(
      JSON.stringify({
        success: true,
        message: 'External wallet connected successfully',
        wallet_address: normalizedAddress
      }),
      { status: 200, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
    );

  } catch (error) {
    console.error('[CONNECT-WALLET] Error:', error);
    return new Response(
      JSON.stringify({ success: false, error: 'Internal server error' }),
      { status: 500, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
    );
  }
});
