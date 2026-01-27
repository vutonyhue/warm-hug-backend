import { createClient } from 'https://esm.sh/@supabase/supabase-js@2';

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
};

interface LeaderboardUser {
  id: string;
  username: string;
  full_name: string | null;
  avatar_url: string | null;
  posts_count: number;
  comments_count: number;
  reactions_on_posts: number;
  friends_count: number;
  livestreams_count: number;
  today_reward: number;
  total_reward: number;
}

Deno.serve(async (req) => {
  // Handle CORS preflight
  if (req.method === 'OPTIONS') {
    return new Response(null, { headers: corsHeaders });
  }

  try {
    const supabase = createClient(
      Deno.env.get('SUPABASE_URL')!,
      Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!
    );

    // Parse request body or query params
    let limit = 100;
    let category = 'reward';

    if (req.method === 'POST') {
      const body = await req.json().catch(() => ({}));
      limit = body.limit || 100;
      category = body.category || 'reward';
    } else {
      const url = new URL(req.url);
      limit = parseInt(url.searchParams.get('limit') || '100');
      category = url.searchParams.get('category') || 'reward';
    }

    // Get profiles with pending rewards
    const { data: profiles, error: profilesError } = await supabase
      .from('profiles')
      .select('id, username, full_name, avatar_url, pending_reward')
      .order('pending_reward', { ascending: false })
      .limit(limit);

    if (profilesError) {
      throw profilesError;
    }

    // Get today's date range for today_reward calculation
    const todayStart = new Date();
    todayStart.setHours(0, 0, 0, 0);
    const todayEnd = new Date();
    todayEnd.setHours(23, 59, 59, 999);

    // Enrich data with counts
    const enrichedData: LeaderboardUser[] = await Promise.all(
      (profiles || []).map(async (profile) => {
        // Parallel count queries
        const [postsResult, commentsResult, friendsResult, livestreamsResult] = await Promise.all([
          supabase
            .from('posts')
            .select('id', { count: 'exact', head: true })
            .eq('user_id', profile.id),
          supabase
            .from('comments')
            .select('id', { count: 'exact', head: true })
            .eq('user_id', profile.id),
          supabase
            .from('friendships')
            .select('id', { count: 'exact', head: true })
            .or(`requester_id.eq.${profile.id},addressee_id.eq.${profile.id}`)
            .eq('status', 'accepted'),
          supabase
            .from('livestreams')
            .select('id', { count: 'exact', head: true })
            .eq('user_id', profile.id)
        ]);

        // Get reactions count on user's posts
        const { data: userPosts } = await supabase
          .from('posts')
          .select('id')
          .eq('user_id', profile.id);

        let reactionsCount = 0;
        if (userPosts && userPosts.length > 0) {
          const postIds = userPosts.map(p => p.id);
          const { count } = await supabase
            .from('reactions')
            .select('id', { count: 'exact', head: true })
            .in('post_id', postIds);
          reactionsCount = count || 0;
        }

        // Calculate today's reward based on today's posts and comments
        const [todayPostsResult, todayCommentsResult] = await Promise.all([
          supabase
            .from('posts')
            .select('id', { count: 'exact', head: true })
            .eq('user_id', profile.id)
            .gte('created_at', todayStart.toISOString())
            .lte('created_at', todayEnd.toISOString()),
          supabase
            .from('comments')
            .select('id', { count: 'exact', head: true })
            .eq('user_id', profile.id)
            .gte('created_at', todayStart.toISOString())
            .lte('created_at', todayEnd.toISOString())
        ]);

        // Simple reward calculation: posts = 10 points, comments = 5 points
        const todayPosts = todayPostsResult.count || 0;
        const todayComments = todayCommentsResult.count || 0;
        const todayReward = (todayPosts * 10) + (todayComments * 5);

        return {
          id: profile.id,
          username: profile.username || 'Unknown',
          full_name: profile.full_name,
          avatar_url: profile.avatar_url,
          posts_count: postsResult.count || 0,
          comments_count: commentsResult.count || 0,
          reactions_on_posts: reactionsCount,
          friends_count: friendsResult.count || 0,
          livestreams_count: livestreamsResult.count || 0,
          today_reward: todayReward,
          total_reward: profile.pending_reward || 0
        };
      })
    );

    // Sort by category
    enrichedData.sort((a, b) => {
      switch (category) {
        case 'posts':
          return b.posts_count - a.posts_count;
        case 'friends':
          return b.friends_count - a.friends_count;
        case 'comments':
          return b.comments_count - a.comments_count;
        case 'reactions_on_posts':
          return b.reactions_on_posts - a.reactions_on_posts;
        case 'livestreams':
          return b.livestreams_count - a.livestreams_count;
        case 'today':
          return b.today_reward - a.today_reward;
        default:
          return b.total_reward - a.total_reward;
      }
    });

    return new Response(JSON.stringify({ data: enrichedData, error: null }), {
      headers: { ...corsHeaders, 'Content-Type': 'application/json' }
    });

  } catch (error) {
    console.error('Leaderboard API error:', error);
    const errorMessage = error instanceof Error ? error.message : 'Unknown error';
    return new Response(
      JSON.stringify({ data: null, error: errorMessage }),
      { 
        status: 500, 
        headers: { ...corsHeaders, 'Content-Type': 'application/json' } 
      }
    );
  }
});
