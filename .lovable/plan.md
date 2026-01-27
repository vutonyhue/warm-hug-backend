
# Kế hoạch: Fix Build Errors + Thiết kế Edge Functions API Layer

## Phần 1: Fix Build Errors

### 1.1 AdminMigration.tsx - Comments table schema mismatch

**Vấn đề:** 
- Query đang select `image_url, video_url` nhưng bảng `comments` chỉ có `media_url, media_type`
- Có 2 nơi cần sửa: dòng 393-396 và 788-791

**Sửa lỗi:**
```typescript
// Line 393-396: Thay đổi query
const { data: comments } = await supabase
  .from('comments')
  .select('id, media_url, media_type')
  .not('media_url', 'is', null);

// Line 788-791: Thay đổi query tương tự
const { data: comments } = await supabase
  .from('comments')
  .select('id, media_url, media_type')
  .not('media_url', 'is', null);
```

**Sửa forEach logic (lines 831-838):**
```typescript
comments?.forEach(comment => {
  if (comment.media_url && comment.media_type === 'image' && isSupabaseUrl(comment.media_url)) {
    urlsToMigrate.push({ table: 'comments', id: comment.id, field: 'media_url', url: comment.media_url! });
  }
  if (comment.media_url && comment.media_type === 'video' && isSupabaseUrl(comment.media_url)) {
    urlsToMigrate.push({ table: 'comments', id: comment.id, field: 'media_url', url: comment.media_url! });
  }
});
```

---

### 1.2 ConnectedApps.tsx - Missing interface properties

**Vấn đề:**
- Interface `ConnectedApp` yêu cầu `last_used_at` và `is_revoked`
- Nhưng mapping object thiếu 2 properties này

**Sửa lỗi (lines 111-118):**
```typescript
const appsWithNames: ConnectedApp[] = (tokens || []).map(token => ({
  id: token.id,
  client_id: token.client_id,
  scope: token.scope ? token.scope.split(',') : [],
  created_at: token.created_at,
  client_name: getClientDisplayName(token.client_id),
  last_used_at: null,  // Thêm property này
  is_revoked: false    // Token đã được filter revoked=false nên luôn là false
}));
```

---

### 1.3 Leaderboard.tsx - Duplicate properties + missing fields

**Vấn đề:**
- Object literal có duplicate keys (`id`, `username`, `avatar_url`)
- RPC `get_user_rewards_v2` không return các fields: `posts_count`, `comments_count`, etc.

**Sửa lỗi - Đơn giản hóa (chỉ dùng data từ RPC):**
```typescript
const usersWithRewards: LeaderboardUser[] = (data || []).map((user) => ({
  id: user.id,
  username: user.username || 'Unknown',
  avatar_url: user.avatar_url,
  full_name: user.full_name,
  posts_count: 0,          // RPC không có, đặt default
  comments_count: 0,
  reactions_on_posts: 0,
  friends_count: 0,
  livestreams_count: 0,
  today_reward: 0,
  total_reward: user.claimable || 0
}));
```

**Hoặc:** Cập nhật RPC function `get_user_rewards_v2` để return thêm các field cần thiết (đề xuất trong Phần 2).

---

## Phần 2: Edge Functions API Layer

### 2.1 Kiến trúc hiện tại vs Đề xuất

```text
+------------------+        +------------------+        +------------------+
|                  |        |                  |        |                  |
|    Frontend      | -----> |  Edge Functions  | -----> |    Database      |
|    (React)       |        |  (API Layer)     |        |    (Postgres)    |
|                  |        |                  |        |                  |
+------------------+        +------------------+        +------------------+
                                    |
                                    v
                           +------------------+
                           |  External APIs   |
                           | (Cloudflare, etc)|
                           +------------------+
```

### 2.2 Edge Functions cần tạo mới

| Function | Mục đích | Priority |
|----------|----------|----------|
| `api-leaderboard` | Lấy leaderboard data với full stats | Cao |
| `api-feed` | Lấy feed posts với pagination | Cao |
| `api-profile` | Lấy/cập nhật profile | Cao |
| `api-friends` | Quản lý friendships | Trung bình |
| `api-notifications` | Lấy/đánh dấu đã đọc notifications | Trung bình |
| `api-reactions` | Thêm/xóa reactions | Cao |
| `api-comments` | CRUD comments | Cao |

### 2.3 Ví dụ: api-leaderboard Edge Function

```typescript
// supabase/functions/api-leaderboard/index.ts
import { createClient } from 'https://esm.sh/@supabase/supabase-js@2';

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
};

Deno.serve(async (req) => {
  if (req.method === 'OPTIONS') {
    return new Response(null, { headers: corsHeaders });
  }

  const supabase = createClient(
    Deno.env.get('SUPABASE_URL')!,
    Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!
  );

  const url = new URL(req.url);
  const limit = parseInt(url.searchParams.get('limit') || '100');
  const category = url.searchParams.get('category') || 'reward';

  // Aggregate data từ nhiều tables
  const { data: profiles } = await supabase
    .from('profiles')
    .select('id, username, full_name, avatar_url, pending_reward')
    .order('pending_reward', { ascending: false })
    .limit(limit);

  // Đếm posts, comments, friends cho mỗi user
  const enrichedData = await Promise.all(
    (profiles || []).map(async (profile) => {
      const [posts, comments, friends, reactions, livestreams] = await Promise.all([
        supabase.from('posts').select('id', { count: 'exact', head: true }).eq('user_id', profile.id),
        supabase.from('comments').select('id', { count: 'exact', head: true }).eq('user_id', profile.id),
        supabase.from('friendships').select('id', { count: 'exact', head: true })
          .or(`requester_id.eq.${profile.id},addressee_id.eq.${profile.id}`)
          .eq('status', 'accepted'),
        supabase.from('reactions').select('id', { count: 'exact', head: true })
          .in('post_id', /* user's post ids */),
        supabase.from('livestreams').select('id', { count: 'exact', head: true }).eq('user_id', profile.id)
      ]);

      return {
        ...profile,
        posts_count: posts.count || 0,
        comments_count: comments.count || 0,
        friends_count: friends.count || 0,
        reactions_on_posts: reactions.count || 0,
        livestreams_count: livestreams.count || 0,
        total_reward: profile.pending_reward || 0,
        today_reward: 0 // Calculate based on today's activities
      };
    })
  );

  // Sort theo category
  enrichedData.sort((a, b) => {
    const key = category === 'reward' ? 'total_reward' : `${category}_count`;
    return (b[key] || 0) - (a[key] || 0);
  });

  return new Response(JSON.stringify(enrichedData), {
    headers: { ...corsHeaders, 'Content-Type': 'application/json' }
  });
});
```

### 2.4 Frontend sẽ gọi Edge Functions thay vì trực tiếp

```typescript
// Thay vì:
const { data } = await supabase.rpc('get_user_rewards_v2', { limit_count: 100 });

// Sẽ gọi:
const response = await supabase.functions.invoke('api-leaderboard', {
  body: { limit: 100, category: 'reward' }
});
```

### 2.5 Lợi ích của Edge Functions Layer

| Lợi ích | Mô tả |
|---------|-------|
| Bảo mật | Frontend không truy cập trực tiếp DB, chỉ qua API |
| Tối ưu | Aggregate data ở server, giảm roundtrips |
| Linh hoạt | Dễ thay đổi logic mà không cập nhật frontend |
| Caching | Có thể cache kết quả ở edge |
| Rate limiting | Kiểm soát request rate |
| Logging | Log tập trung cho monitoring |

---

## Tóm tắt thực hiện

### Phase 1: Fix Build Errors (Ngay)
1. Sửa `AdminMigration.tsx` - comments query
2. Sửa `ConnectedApps.tsx` - thêm missing properties  
3. Sửa `Leaderboard.tsx` - xóa duplicate keys

### Phase 2: Edge Functions (Sau khi build pass)
1. Tạo `api-leaderboard` Edge Function với full aggregation
2. Cập nhật Leaderboard.tsx để gọi Edge Function
3. Tạo thêm các Edge Functions khác theo priority

### Files cần sửa:
- `src/pages/AdminMigration.tsx` (4 locations)
- `src/pages/ConnectedApps.tsx` (1 location)
- `src/pages/Leaderboard.tsx` (1 location)
- `supabase/functions/api-leaderboard/index.ts` (tạo mới)
