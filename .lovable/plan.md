
# Đánh giá Bảo mật Backend & Kế hoạch Chuyển đổi sang API Layer

## Phần 1: Đánh giá Hiện trạng

### 1.1 Kiến trúc Hiện tại

```text
┌─────────────────┐     ┌─────────────────┐     ┌─────────────────┐
│                 │     │   Supabase      │     │                 │
│    Frontend     │────▶│   Client SDK    │────▶│    Database     │
│    (React)      │     │   (Anon Key)    │     │   (Postgres)    │
│                 │     │                 │     │                 │
└─────────────────┘     └─────────────────┘     └─────────────────┘
         │                                              ▲
         │              ┌─────────────────┐             │
         └─────────────▶│  Edge Functions │─────────────┘
                        │  (Service Role) │
                        └─────────────────┘
```

**Vấn đề:**
- Frontend truy cập **trực tiếp** database qua Supabase SDK (123 lần gọi `supabase.from()` trong codebase)
- RLS policies là tuyến phòng thủ duy nhất
- Không có rate limiting tập trung
- Không có logging/monitoring tập trung

### 1.2 Các Vấn đề Bảo mật Phát hiện (Security Scan)

| Mức độ | Vấn đề | Bảng/Component |
|--------|--------|----------------|
| 🔴 CRITICAL | OAuth Client Secrets lộ công khai | `oauth_clients` |
| 🔴 CRITICAL | Encrypted private keys có thể bị đọc | `custodial_wallets` |
| 🔴 CRITICAL | Dữ liệu tài chính người dùng lộ công khai | `profiles` |
| 🟡 WARNING | OAuth codes policy quá lỏng lẻo | `oauth_codes` |
| 🟡 WARNING | Leaked password protection chưa bật | Auth settings |
| 🟡 WARNING | `public_profiles` view không có RLS | `public_profiles` |
| 🔵 INFO | Notifications có thể bị spam | `notifications` |
| 🔵 INFO | Livestreams thiếu privacy control | `livestreams` |

---

## Phần 2: So sánh với Big Tech Architecture

### 2.1 Big Tech Pattern (Google, Meta, Amazon...)

```text
┌─────────────┐    ┌─────────────┐    ┌─────────────┐    ┌─────────────┐
│             │    │             │    │             │    │             │
│   Client    │───▶│  API Layer  │───▶│   Service   │───▶│  Database   │
│   (App)     │    │  (Gateway)  │    │   Layer     │    │             │
│             │    │             │    │             │    │             │
└─────────────┘    └─────────────┘    └─────────────┘    └─────────────┘
                          │
                   ┌──────┴──────┐
                   │             │
              Rate Limit    Auth/Authz
              Logging       Validation
              Caching       Sanitization
```

**Lợi ích:**
1. **Defense in Depth**: Nhiều lớp bảo vệ
2. **Rate Limiting**: Kiểm soát traffic ở API layer
3. **Logging/Monitoring**: Theo dõi tất cả requests
4. **Validation**: Validate input trước khi chạm DB
5. **Caching**: Cache ở edge, giảm tải DB
6. **Abstraction**: Thay đổi DB không ảnh hưởng client

### 2.2 Hiện trạng vs Big Tech

| Tiêu chí | Fun Profile (Hiện tại) | Big Tech Standard |
|----------|------------------------|-------------------|
| Direct DB Access | ✅ Có (123 calls) | ❌ Không |
| API Gateway | ❌ Không | ✅ Có |
| Rate Limiting | ❌ Không tập trung | ✅ Tập trung |
| Input Validation | ⚠️ Một phần | ✅ Đầy đủ |
| Audit Logging | ⚠️ Một phần | ✅ Đầy đủ |
| Defense in Depth | ⚠️ Chỉ RLS | ✅ Nhiều lớp |

---

## Phần 3: Kế hoạch Cải thiện

### 3.1 Phase 1: Fix Critical Security Issues (Khẩn cấp)

**3.1.1 Fix OAuth Client Secrets Exposure**
```sql
-- Tạo view an toàn chỉ expose non-sensitive fields
CREATE VIEW public.oauth_clients_public AS
SELECT id, name, redirect_uris, allowed_scopes, is_active
FROM public.oauth_clients
WHERE is_active = true;

-- Revoke SELECT on main table, only allow view
DROP POLICY IF EXISTS "Anyone can view active oauth clients" ON oauth_clients;
CREATE POLICY "Only service role can access oauth_clients" ON oauth_clients
  FOR ALL USING (auth.role() = 'service_role');
```

**3.1.2 Fix Custodial Wallets - Hide encrypted keys**
```sql
-- Tạo view không bao gồm private key
CREATE VIEW public.user_custodial_wallets AS
SELECT id, user_id, address, created_at
FROM public.custodial_wallets;

-- Update RLS: user chỉ xem được view, không xem main table
DROP POLICY IF EXISTS "Users can view own wallet" ON custodial_wallets;
CREATE POLICY "Only service role can access custodial_wallets" ON custodial_wallets
  FOR ALL USING (auth.role() = 'service_role');
```

**3.1.3 Fix Profiles - Hide financial data**
```sql
-- Tách profiles thành public/private views
CREATE VIEW public.public_user_profiles AS
SELECT id, username, full_name, avatar_url, cover_url, bio, soul_level, fun_id, created_at
FROM public.profiles;

-- Update main table RLS để hide financial data từ public
DROP POLICY IF EXISTS "Profiles are viewable by everyone" ON profiles;
CREATE POLICY "Users can view own full profile" ON profiles
  FOR SELECT USING (auth.uid() = id);
CREATE POLICY "Public can view limited profile data" ON profiles
  FOR SELECT USING (true)
  -- Có thể dùng Column Level Security hoặc View
```

**3.1.4 Bật Leaked Password Protection**
- Vào Supabase Dashboard → Auth → Settings → Enable Leaked Password Protection

### 3.2 Phase 2: Implement API Layer (Edge Functions)

**3.2.1 Core API Functions cần tạo**

| Function | Mục đích | Priority |
|----------|----------|----------|
| `api-feed` | Lấy posts với pagination, aggregation | Cao |
| `api-profile` | Get/update profile an toàn | Cao |
| `api-comments` | CRUD comments với validation | Cao |
| `api-reactions` | Add/remove reactions | Cao |
| `api-notifications` | Get/mark read notifications | Trung bình |
| `api-friends` | Quản lý friendships | Trung bình |
| `api-conversations` | Chat conversations | Trung bình |
| `api-messages` | Send/get messages | Trung bình |

**3.2.2 API Function Template với Security**

```typescript
// supabase/functions/api-feed/index.ts
import { createClient } from 'https://esm.sh/@supabase/supabase-js@2';

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
};

// Rate limiting helper
const RATE_LIMIT_WINDOW = 60000; // 1 minute
const RATE_LIMIT_MAX = 60; // 60 requests per minute

Deno.serve(async (req) => {
  if (req.method === 'OPTIONS') {
    return new Response(null, { headers: corsHeaders });
  }

  const startTime = Date.now();
  
  try {
    // 1. Authentication
    const authHeader = req.headers.get('Authorization');
    if (!authHeader?.startsWith('Bearer ')) {
      return new Response(
        JSON.stringify({ error: 'Unauthorized' }),
        { status: 401, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
    }

    const supabaseUrl = Deno.env.get('SUPABASE_URL')!;
    const supabaseServiceKey = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!;
    const supabaseAnonKey = Deno.env.get('SUPABASE_ANON_KEY')!;

    // User client for auth verification
    const supabaseUser = createClient(supabaseUrl, supabaseAnonKey, {
      global: { headers: { Authorization: authHeader } },
    });

    const { data: { user }, error: authError } = await supabaseUser.auth.getUser();
    if (authError || !user) {
      return new Response(
        JSON.stringify({ error: 'Invalid token' }),
        { status: 401, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
    }

    // 2. Rate Limiting
    const supabaseAdmin = createClient(supabaseUrl, supabaseServiceKey);
    const rateLimitKey = `api-feed:${user.id}`;
    
    const { data: allowed } = await supabaseAdmin.rpc('check_rate_limit', {
      rate_key: rateLimitKey,
      max_count: RATE_LIMIT_MAX,
      window_ms: RATE_LIMIT_WINDOW
    });

    if (!allowed) {
      return new Response(
        JSON.stringify({ error: 'Rate limit exceeded', retry_after: 60 }),
        { status: 429, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
    }

    // 3. Parse & Validate Input
    const url = new URL(req.url);
    const cursor = url.searchParams.get('cursor');
    const limit = Math.min(parseInt(url.searchParams.get('limit') || '10'), 50);

    // 4. Business Logic (using Service Role for aggregation)
    let query = supabaseAdmin
      .from('posts')
      .select(`
        id, content, image_url, video_url, media_urls, 
        created_at, user_id, location, feeling, activity
      `)
      .order('created_at', { ascending: false })
      .limit(limit + 1);

    if (cursor) {
      query = query.lt('created_at', cursor);
    }

    const { data: posts, error } = await query;
    if (error) throw error;

    const hasMore = (posts?.length || 0) > limit;
    const postsToReturn = hasMore ? posts?.slice(0, limit) : posts;

    // Aggregate profiles, reactions, comments counts server-side
    const userIds = [...new Set((postsToReturn || []).map(p => p.user_id))];
    const postIds = (postsToReturn || []).map(p => p.id);

    const [profilesRes, reactionsRes, commentsRes, sharesRes] = await Promise.all([
      supabaseAdmin.from('profiles').select('id, username, avatar_url').in('id', userIds),
      supabaseAdmin.from('reactions').select('id, post_id, user_id, reaction_type').in('post_id', postIds),
      supabaseAdmin.from('comments').select('post_id').in('post_id', postIds),
      supabaseAdmin.from('shared_posts').select('original_post_id').in('original_post_id', postIds),
    ]);

    // Build response
    const profileMap = new Map((profilesRes.data || []).map(p => [p.id, p]));
    
    const enrichedPosts = (postsToReturn || []).map(post => ({
      ...post,
      profiles: profileMap.get(post.user_id) || { username: 'Unknown', avatar_url: null },
      stats: {
        reactions: (reactionsRes.data || []).filter(r => r.post_id === post.id),
        comment_count: (commentsRes.data || []).filter(c => c.post_id === post.id).length,
        share_count: (sharesRes.data || []).filter(s => s.original_post_id === post.id).length,
      }
    }));

    // 5. Audit Logging (async, non-blocking)
    const duration = Date.now() - startTime;
    console.log(`[api-feed] user=${user.id.substring(0,8)} posts=${enrichedPosts.length} duration=${duration}ms`);

    return new Response(
      JSON.stringify({
        data: enrichedPosts,
        next_cursor: hasMore ? postsToReturn?.[postsToReturn.length - 1]?.created_at : null,
        has_more: hasMore,
      }),
      { headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
    );

  } catch (error: any) {
    console.error('[api-feed] Error:', error.message);
    return new Response(
      JSON.stringify({ error: 'Internal server error' }),
      { status: 500, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
    );
  }
});
```

### 3.3 Phase 3: Migrate Frontend to API Layer

**3.3.1 Thay đổi trong Hooks**

```typescript
// BEFORE: Direct DB access
const { data: posts } = await supabase
  .from('posts')
  .select('*')
  .order('created_at', { ascending: false });

// AFTER: Via API Layer
const { data, error } = await supabase.functions.invoke('api-feed', {
  body: { cursor: null, limit: 10 }
});
```

**3.3.2 Files cần migrate**

| File | Số lần gọi DB | Priority |
|------|---------------|----------|
| `src/hooks/useFeedPosts.ts` | 4 queries | Cao |
| `src/hooks/useConversations.ts` | 6 queries | Trung bình |
| `src/hooks/useMessages.ts` | 3 queries | Trung bình |
| `src/components/feed/CommentSection.tsx` | 4 queries | Cao |
| `src/pages/Profile.tsx` | 5+ queries | Cao |
| Others (8 files) | ~100 queries | Thấp |

### 3.4 Phase 4: Enhanced Security Layer

**3.4.1 Input Validation với Zod**

```typescript
import { z } from 'npm:zod@3.22.4';

const CreatePostSchema = z.object({
  content: z.string().min(1).max(20000),
  media_urls: z.array(z.object({
    url: z.string().url(),
    type: z.enum(['image', 'video'])
  })).max(10).optional(),
  location: z.string().max(200).optional(),
  tagged_user_ids: z.array(z.string().uuid()).max(50).optional(),
});

// In edge function:
const body = await req.json();
const validated = CreatePostSchema.safeParse(body);
if (!validated.success) {
  return new Response(
    JSON.stringify({ error: 'Validation failed', details: validated.error.issues }),
    { status: 400, headers: corsHeaders }
  );
}
```

**3.4.2 Comprehensive Rate Limiting**

| Endpoint | Limit | Window |
|----------|-------|--------|
| api-feed | 60/min | 1 min |
| api-post (create) | 10/min | 1 min |
| api-comment | 30/min | 1 min |
| api-reaction | 100/min | 1 min |
| api-message | 50/min | 1 min |
| sso-* | 10/min | 1 min |

**3.4.3 Audit Logging Table**

```sql
CREATE TABLE public.api_audit_logs (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id uuid REFERENCES auth.users(id),
  endpoint text NOT NULL,
  method text NOT NULL,
  ip_address text,
  user_agent text,
  request_body jsonb,
  response_status integer,
  duration_ms integer,
  created_at timestamptz DEFAULT now()
);

-- Index cho monitoring
CREATE INDEX idx_api_audit_logs_user ON api_audit_logs(user_id, created_at DESC);
CREATE INDEX idx_api_audit_logs_endpoint ON api_audit_logs(endpoint, created_at DESC);

-- RLS: Only admin can view
ALTER TABLE api_audit_logs ENABLE ROW LEVEL SECURITY;
CREATE POLICY "Admins can view audit logs" ON api_audit_logs
  FOR SELECT USING (has_role(auth.uid(), 'admin'));
```

---

## Phần 4: Tóm tắt Hành động

### 4.1 Urgent (Làm ngay)

1. ✅ Fix OAuth client secrets exposure
2. ✅ Fix custodial_wallets private key exposure  
3. ✅ Fix profiles financial data exposure
4. ✅ Bật Leaked Password Protection

### 4.2 High Priority (1-2 tuần)

1. Tạo `api-feed` Edge Function với full security
2. Tạo `api-profile` Edge Function
3. Tạo `api-comments` và `api-reactions` Edge Functions
4. Migrate `useFeedPosts.ts` sang API layer

### 4.3 Medium Priority (2-4 tuần)

1. Tạo các API Functions còn lại (notifications, friends, chat)
2. Migrate tất cả frontend hooks
3. Implement comprehensive audit logging
4. Setup monitoring/alerting

### 4.4 Long-term (1-2 tháng)

1. Remove direct DB access từ frontend hoàn toàn
2. Implement caching layer (Redis/Edge cache)
3. Add anomaly detection
4. Security audit bởi bên thứ 3

---

## Phần 5: Kiến trúc Đề xuất (Target State)

```text
┌─────────────────┐     ┌─────────────────┐     ┌─────────────────┐
│                 │     │ Edge Functions  │     │                 │
│    Frontend     │────▶│   API Layer     │────▶│    Database     │
│    (React)      │     │                 │     │   (Postgres)    │
│                 │     │  - Auth         │     │                 │
└─────────────────┘     │  - Rate Limit   │     └─────────────────┘
                        │  - Validation   │
                        │  - Logging      │
                        │  - Aggregation  │
                        └─────────────────┘
                               │
                    ┌──────────┴──────────┐
                    ▼                     ▼
             ┌─────────────┐       ┌─────────────┐
             │ Cloudflare  │       │  External   │
             │     R2      │       │    APIs     │
             │  (Media)    │       │             │
             └─────────────┘       └─────────────┘
```

**Benefits:**
- ✅ Frontend không truy cập trực tiếp DB
- ✅ Rate limiting tập trung
- ✅ Input validation ở API layer
- ✅ Audit logging đầy đủ
- ✅ Aggregation server-side (tối ưu performance)
- ✅ Defense in depth (RLS vẫn là backup)
- ✅ Dễ scale và maintain

---

## Files sẽ thay đổi

### Phase 1 (Security Fixes):
- Database migrations cho RLS policies và views

### Phase 2 (API Layer):
- `supabase/functions/api-feed/index.ts` (tạo mới)
- `supabase/functions/api-profile/index.ts` (tạo mới)
- `supabase/functions/api-comments/index.ts` (tạo mới)
- `supabase/functions/api-reactions/index.ts` (tạo mới)
- `supabase/functions/api-notifications/index.ts` (tạo mới)
- `supabase/functions/api-friends/index.ts` (tạo mới)

### Phase 3 (Frontend Migration):
- `src/hooks/useFeedPosts.ts` (sửa)
- `src/hooks/useConversations.ts` (sửa)
- `src/hooks/useMessages.ts` (sửa)
- `src/components/feed/CommentSection.tsx` (sửa)
- Và các files khác có direct DB access
