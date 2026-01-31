import { createClient } from 'https://esm.sh/@supabase/supabase-js@2.93.1'

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type, x-supabase-client-platform, x-supabase-client-platform-version, x-supabase-client-runtime, x-supabase-client-runtime-version',
}

// Agora RTC Token Generator (simplified version for RTC)
// Based on Agora Token Builder pattern

interface TokenPayload {
  appId: string;
  appCertificate: string;
  channelName: string;
  uid: number;
  role: number; // 1 = publisher, 2 = subscriber
  privilegeExpiredTs: number;
}

// Simple CRC32 implementation
function crc32(str: string): number {
  let crc = 0xFFFFFFFF;
  const table = new Uint32Array(256);
  
  for (let i = 0; i < 256; i++) {
    let c = i;
    for (let j = 0; j < 8; j++) {
      c = (c & 1) ? (0xEDB88320 ^ (c >>> 1)) : (c >>> 1);
    }
    table[i] = c;
  }
  
  const bytes = new TextEncoder().encode(str);
  for (const byte of bytes) {
    crc = table[(crc ^ byte) & 0xFF] ^ (crc >>> 8);
  }
  
  return (crc ^ 0xFFFFFFFF) >>> 0;
}

// Pack string with length prefix
function packString(str: string): Uint8Array {
  const bytes = new TextEncoder().encode(str);
  const len = bytes.length;
  const result = new Uint8Array(2 + len);
  result[0] = len & 0xFF;
  result[1] = (len >> 8) & 0xFF;
  return new Uint8Array([...result.slice(0, 2), ...bytes]);
}

// Pack uint32 in little endian
function packUint32(value: number): Uint8Array {
  return new Uint8Array([
    value & 0xFF,
    (value >> 8) & 0xFF,
    (value >> 16) & 0xFF,
    (value >> 24) & 0xFF
  ]);
}

// HMAC-SHA256 using Web Crypto
async function hmacSha256(key: Uint8Array, data: Uint8Array): Promise<Uint8Array> {
  const cryptoKey = await crypto.subtle.importKey(
    'raw',
    key.buffer as ArrayBuffer,
    { name: 'HMAC', hash: 'SHA-256' },
    false,
    ['sign']
  );
  const signature = await crypto.subtle.sign('HMAC', cryptoKey, data.buffer as ArrayBuffer);
  return new Uint8Array(signature);
}

// Build RTC Token (version 007)
async function buildToken(payload: TokenPayload): Promise<string> {
  const { appId, appCertificate, channelName, uid, role, privilegeExpiredTs } = payload;
  
  // Build message
  const ts = Math.floor(Date.now() / 1000);
  const salt = Math.floor(Math.random() * 100000);
  
  // Pack privileges
  const privileges = new Map<number, number>();
  privileges.set(1, privilegeExpiredTs); // kJoinChannel
  privileges.set(2, privilegeExpiredTs); // kPublishAudioStream  
  privileges.set(3, privilegeExpiredTs); // kPublishVideoStream
  privileges.set(4, privilegeExpiredTs); // kPublishDataStream
  
  // Build privilege message
  let msgLen = 0;
  const privilegeBytes: number[] = [];
  
  // Add salt (4 bytes)
  privilegeBytes.push(...packUint32(salt));
  msgLen += 4;
  
  // Add ts (4 bytes)
  privilegeBytes.push(...packUint32(ts));
  msgLen += 4;
  
  // Add privileges map
  privilegeBytes.push(...packUint32(privileges.size));
  msgLen += 4;
  
  privileges.forEach((expire, key) => {
    privilegeBytes.push(...packUint32(key));
    privilegeBytes.push(...packUint32(expire));
    msgLen += 8;
  });
  
  // Build content
  const content: number[] = [];
  content.push(...packString(appId));
  content.push(...packString(channelName));
  content.push(...packString(String(uid)));
  content.push(...Uint8Array.from(privilegeBytes));
  
  // Sign with HMAC-SHA256
  const certBytes = new TextEncoder().encode(appCertificate);
  const contentBytes = new Uint8Array(content);
  const signature = await hmacSha256(certBytes, contentBytes);
  
  // Build final token
  const tokenVersion = '007';
  
  // Concatenate: signature (32) + crc32_channel (4) + crc32_uid (4) + msgLen (4) + content
  const crcChannel = crc32(channelName);
  const crcUid = crc32(String(uid));
  
  const finalBuffer = new Uint8Array([
    ...signature,
    ...packUint32(crcChannel),
    ...packUint32(crcUid),
    ...packUint32(contentBytes.length),
    ...contentBytes
  ]);
  
  // Base64 encode
  const base64 = btoa(String.fromCharCode(...finalBuffer));
  
  return tokenVersion + appId + base64;
}

Deno.serve(async (req) => {
  // Handle CORS preflight
  if (req.method === 'OPTIONS') {
    return new Response(null, { headers: corsHeaders });
  }

  try {
    // Verify authorization
    const authHeader = req.headers.get('Authorization');
    if (!authHeader?.startsWith('Bearer ')) {
      return new Response(
        JSON.stringify({ error: 'Unauthorized' }), 
        { status: 401, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
    }

    const supabase = createClient(
      Deno.env.get('SUPABASE_URL')!,
      Deno.env.get('SUPABASE_ANON_KEY')!,
      { global: { headers: { Authorization: authHeader } } }
    );

    const token = authHeader.replace('Bearer ', '');
    const { data: authData, error: authError } = await supabase.auth.getUser(token);
    
    if (authError || !authData?.user) {
      return new Response(
        JSON.stringify({ error: 'Unauthorized' }), 
        { status: 401, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
    }

    const userId = authData.user.id;

    // Parse request
    const { channelName, uid, role = 1 } = await req.json();

    if (!channelName) {
      return new Response(
        JSON.stringify({ error: 'channelName is required' }), 
        { status: 400, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
    }

    // Get Agora credentials
    const appId = Deno.env.get('AGORA_APP_ID');
    const appCertificate = Deno.env.get('AGORA_APP_CERTIFICATE');

    if (!appId || !appCertificate) {
      console.error('[agora-token] Missing Agora credentials');
      return new Response(
        JSON.stringify({ error: 'Agora not configured' }), 
        { status: 500, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
    }

    // Generate numeric UID from user ID (hash to 32-bit int)
    const numericUid = uid || Math.abs(crc32(userId));
    
    // Token expires in 24 hours
    const privilegeExpiredTs = Math.floor(Date.now() / 1000) + 86400;

    // Build token
    const agoraToken = await buildToken({
      appId,
      appCertificate,
      channelName,
      uid: numericUid,
      role,
      privilegeExpiredTs,
    });

    console.log(`[agora-token] Generated token for channel: ${channelName}, uid: ${numericUid}`);

    return new Response(
      JSON.stringify({ 
        token: agoraToken,
        appId,
        channelName,
        uid: numericUid,
        expiresAt: privilegeExpiredTs,
      }), 
      { headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
    );

  } catch (error: unknown) {
    console.error('[agora-token] Error:', error);
    const message = error instanceof Error ? error.message : 'Unknown error';
    return new Response(
      JSON.stringify({ error: message }), 
      { status: 500, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
    );
  }
});
