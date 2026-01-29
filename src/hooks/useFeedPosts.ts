import { useInfiniteQuery, useQueryClient } from '@tanstack/react-query';
import { useEffect, useCallback } from 'react';
import { supabase } from '@/integrations/supabase/client';

export interface PostStats {
  reactions: { id: string; user_id: string; type: string }[];
  commentCount: number;
  shareCount: number;
}

export interface FeedPost {
  id: string;
  content: string;
  image_url: string | null;
  video_url: string | null;
  media_urls: Array<{ url: string; type: 'image' | 'video' }> | null;
  created_at: string;
  user_id: string;
  profiles: {
    username: string;
    avatar_url: string | null;
  };
}

interface APIFeedPost {
  id: string;
  content: string | null;
  image_url: string | null;
  video_url: string | null;
  media_urls: any;
  created_at: string | null;
  user_id: string;
  profiles: {
    username: string;
    avatar_url: string | null;
  };
  stats: {
    reactions: { id: string; user_id: string; type: string }[];
    comment_count: number;
    share_count: number;
  };
}

interface APIResponse {
  data: APIFeedPost[];
  next_cursor: string | null;
  has_more: boolean;
  error?: string;
}

interface FeedPage {
  posts: FeedPost[];
  postStats: Record<string, PostStats>;
  nextCursor: string | null;
}

const POSTS_PER_PAGE = 10;

// Fetch a page of posts via API Layer (Edge Function)
const fetchFeedPage = async (cursor: string | null): Promise<FeedPage> => {
  // Get current session for auth header
  const { data: { session } } = await supabase.auth.getSession();
  
  if (!session?.access_token) {
    throw new Error('Not authenticated');
  }

  // Build URL with query params
  const params = new URLSearchParams({
    limit: POSTS_PER_PAGE.toString(),
  });
  if (cursor) {
    params.set('cursor', cursor);
  }

  const { data, error } = await supabase.functions.invoke<APIResponse>('api-feed', {
    method: 'GET',
    headers: {
      'Content-Type': 'application/json',
    },
    body: null,
  });

  // Handle invoke with query params - use fetch directly for GET with params
  const response = await fetch(
    `${import.meta.env.VITE_SUPABASE_URL}/functions/v1/api-feed?${params.toString()}`,
    {
      method: 'GET',
      headers: {
        'Authorization': `Bearer ${session.access_token}`,
        'Content-Type': 'application/json',
        'apikey': import.meta.env.VITE_SUPABASE_PUBLISHABLE_KEY,
      },
    }
  );

  if (!response.ok) {
    const errorData = await response.json().catch(() => ({ error: 'Unknown error' }));
    throw new Error(errorData.error || `HTTP ${response.status}`);
  }

  const apiResponse: APIResponse = await response.json();

  if (apiResponse.error) {
    throw new Error(apiResponse.error);
  }

  // Transform API response to match existing FeedPage structure
  const posts: FeedPost[] = (apiResponse.data || []).map((post) => ({
    id: post.id,
    content: post.content || '',
    image_url: post.image_url,
    video_url: post.video_url,
    media_urls: post.media_urls as Array<{ url: string; type: 'image' | 'video' }> | null,
    created_at: post.created_at || new Date().toISOString(),
    user_id: post.user_id,
    profiles: post.profiles,
  }));

  // Build postStats from API response
  const postStats: Record<string, PostStats> = {};
  (apiResponse.data || []).forEach((post) => {
    postStats[post.id] = {
      reactions: post.stats.reactions,
      commentCount: post.stats.comment_count,
      shareCount: post.stats.share_count,
    };
  });

  return {
    posts,
    postStats,
    nextCursor: apiResponse.next_cursor,
  };
};

export const useFeedPosts = () => {
  const queryClient = useQueryClient();

  const query = useInfiniteQuery<FeedPage, Error>({
    queryKey: ['feed-posts'],
    queryFn: ({ pageParam }) => fetchFeedPage(pageParam as string | null),
    initialPageParam: null as string | null,
    getNextPageParam: (lastPage: FeedPage) => lastPage.nextCursor ?? undefined,
    staleTime: 30 * 1000,
    gcTime: 5 * 60 * 1000,
    refetchOnWindowFocus: false,
    retry: 2,
  });

  const refetch = useCallback(() => {
    queryClient.invalidateQueries({ queryKey: ['feed-posts'] });
  }, [queryClient]);

  useEffect(() => {
    const channel = supabase
      .channel('feed-posts-realtime')
      .on(
        'postgres_changes',
        { event: 'INSERT', schema: 'public', table: 'posts' },
        () => {
          queryClient.invalidateQueries({ queryKey: ['feed-posts'] });
        }
      )
      .on(
        'postgres_changes',
        { event: 'DELETE', schema: 'public', table: 'posts' },
        () => {
          queryClient.invalidateQueries({ queryKey: ['feed-posts'] });
        }
      )
      .subscribe();

    return () => {
      supabase.removeChannel(channel);
    };
  }, [queryClient]);

  const allPosts = query.data?.pages?.flatMap(page => page.posts) || [];
  const allPostStats = query.data?.pages?.reduce((acc, page) => {
    return { ...acc, ...page.postStats };
  }, {} as Record<string, PostStats>) || {};

  return {
    posts: allPosts,
    postStats: allPostStats,
    isLoading: query.isLoading,
    isFetchingNextPage: query.isFetchingNextPage,
    hasNextPage: query.hasNextPage ?? false,
    fetchNextPage: query.fetchNextPage,
    refetch,
  };
};
