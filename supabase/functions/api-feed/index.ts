import { createClient } from "https://esm.sh/@supabase/supabase-js@2.49.1";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type, x-supabase-client-platform, x-supabase-client-platform-version, x-supabase-client-runtime, x-supabase-client-runtime-version",
};

// Rate limiting configuration
const RATE_LIMIT_WINDOW = 60000; // 1 minute
const RATE_LIMIT_MAX = 60; // 60 requests per minute

interface FeedPost {
  id: string;
  content: string | null;
  image_url: string | null;
  video_url: string | null;
  media_urls: any;
  created_at: string | null;
  user_id: string;
  location: string | null;
  feeling: string | null;
  activity: string | null;
  privacy: string | null;
}

Deno.serve(async (req) => {
  // Handle CORS preflight
  if (req.method === "OPTIONS") {
    return new Response(null, { headers: corsHeaders });
  }

  const startTime = Date.now();

  try {
    // 1. Authentication - Validate JWT
    const authHeader = req.headers.get("Authorization");
    if (!authHeader?.startsWith("Bearer ")) {
      console.log("[api-feed] No auth header");
      return new Response(
        JSON.stringify({ error: "Unauthorized" }),
        { status: 401, headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );
    }

    const supabaseUrl = Deno.env.get("SUPABASE_URL")!;
    const supabaseServiceKey = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!;
    const supabaseAnonKey = Deno.env.get("SUPABASE_ANON_KEY")!;

    // User client for auth verification
    const supabaseUser = createClient(supabaseUrl, supabaseAnonKey, {
      global: { headers: { Authorization: authHeader } },
    });

    const { data: { user }, error: authError } = await supabaseUser.auth.getUser();
    if (authError || !user) {
      console.log("[api-feed] Invalid token:", authError?.message);
      return new Response(
        JSON.stringify({ error: "Invalid token" }),
        { status: 401, headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );
    }

    // Admin client for data operations
    const supabaseAdmin = createClient(supabaseUrl, supabaseServiceKey);

    // 2. Rate Limiting
    const rateLimitKey = `api-feed:${user.id}`;
    const { data: allowed } = await supabaseAdmin.rpc("check_rate_limit", {
      rate_key: rateLimitKey,
      max_count: RATE_LIMIT_MAX,
      window_ms: RATE_LIMIT_WINDOW,
    });

    if (!allowed) {
      console.log("[api-feed] Rate limit exceeded for user:", user.id.substring(0, 8));
      return new Response(
        JSON.stringify({ error: "Rate limit exceeded", retry_after: 60 }),
        { status: 429, headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );
    }

    // 3. Parse & Validate Input
    const url = new URL(req.url);
    const cursor = url.searchParams.get("cursor");
    const limitParam = parseInt(url.searchParams.get("limit") || "10");
    const limit = Math.min(Math.max(1, limitParam), 50); // Clamp between 1 and 50

    console.log("[api-feed] Request:", { userId: user.id.substring(0, 8), cursor, limit });

    // 4. Fetch Posts with Cursor Pagination
    let query = supabaseAdmin
      .from("posts")
      .select(`
        id, content, image_url, video_url, media_urls, 
        created_at, user_id, location, feeling, activity, privacy
      `)
      .order("created_at", { ascending: false })
      .limit(limit + 1); // Fetch one extra to check for more

    if (cursor) {
      query = query.lt("created_at", cursor);
    }

    const { data: posts, error: postsError } = await query;
    if (postsError) {
      console.error("[api-feed] Posts fetch error:", postsError.message);
      throw postsError;
    }

    const hasMore = (posts?.length || 0) > limit;
    const postsToReturn = hasMore ? posts?.slice(0, limit) : posts;

    if (!postsToReturn || postsToReturn.length === 0) {
      return new Response(
        JSON.stringify({
          data: [],
          next_cursor: null,
          has_more: false,
        }),
        { headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );
    }

    // 5. Batch Aggregate Related Data (Server-side join)
    const userIds = [...new Set(postsToReturn.map((p: FeedPost) => p.user_id))];
    const postIds = postsToReturn.map((p: FeedPost) => p.id);

    const [profilesRes, reactionsRes, commentsRes, sharesRes] = await Promise.all([
      supabaseAdmin
        .from("profiles")
        .select("id, username, avatar_url")
        .in("id", userIds),
      supabaseAdmin
        .from("reactions")
        .select("id, post_id, user_id, reaction_type")
        .in("post_id", postIds),
      supabaseAdmin
        .from("comments")
        .select("post_id")
        .in("post_id", postIds),
      supabaseAdmin
        .from("shared_posts")
        .select("original_post_id")
        .in("original_post_id", postIds),
    ]);

    // Handle potential errors in parallel queries
    if (profilesRes.error) console.warn("[api-feed] Profiles error:", profilesRes.error.message);
    if (reactionsRes.error) console.warn("[api-feed] Reactions error:", reactionsRes.error.message);
    if (commentsRes.error) console.warn("[api-feed] Comments error:", commentsRes.error.message);
    if (sharesRes.error) console.warn("[api-feed] Shares error:", sharesRes.error.message);

    // Build lookup maps for efficient aggregation
    const profileMap = new Map(
      (profilesRes.data || []).map((p) => [p.id, { username: p.username, avatar_url: p.avatar_url }])
    );

    // 6. Enrich Posts with Aggregated Data
    const enrichedPosts = postsToReturn.map((post: FeedPost) => ({
      id: post.id,
      content: post.content,
      image_url: post.image_url,
      video_url: post.video_url,
      media_urls: post.media_urls,
      created_at: post.created_at,
      user_id: post.user_id,
      location: post.location,
      feeling: post.feeling,
      activity: post.activity,
      privacy: post.privacy,
      profiles: profileMap.get(post.user_id) || { username: "Unknown", avatar_url: null },
      stats: {
        reactions: (reactionsRes.data || [])
          .filter((r) => r.post_id === post.id)
          .map((r) => ({ id: r.id, user_id: r.user_id, type: r.reaction_type })),
        comment_count: (commentsRes.data || []).filter((c) => c.post_id === post.id).length,
        share_count: (sharesRes.data || []).filter((s) => s.original_post_id === post.id).length,
      },
    }));

    const nextCursor = hasMore ? postsToReturn[postsToReturn.length - 1]?.created_at : null;

    // 7. Audit Logging
    const duration = Date.now() - startTime;
    console.log(`[api-feed] Success: user=${user.id.substring(0, 8)} posts=${enrichedPosts.length} duration=${duration}ms`);

    return new Response(
      JSON.stringify({
        data: enrichedPosts,
        next_cursor: nextCursor,
        has_more: hasMore,
      }),
      { headers: { ...corsHeaders, "Content-Type": "application/json" } }
    );

  } catch (error: any) {
    const duration = Date.now() - startTime;
    console.error(`[api-feed] Error after ${duration}ms:`, error.message, error.stack);
    return new Response(
      JSON.stringify({ error: "Internal server error" }),
      { status: 500, headers: { ...corsHeaders, "Content-Type": "application/json" } }
    );
  }
});
