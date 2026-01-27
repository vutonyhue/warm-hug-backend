import { useState, useEffect } from 'react';
import { Button } from '@/components/ui/button';
import { Heart } from 'lucide-react';
import { supabase } from '@/integrations/supabase/client';
import { useLanguage } from '@/i18n/LanguageContext';
import { toast } from 'sonner';
import { cn } from '@/lib/utils';

interface CommentReactionButtonProps {
  commentId: string;
  initialReactionCount?: number;
  onReactionChange?: () => void;
}

// Simplified like counter using localStorage until comment reactions are in database
export const CommentReactionButton = ({
  commentId,
  initialReactionCount = 0,
  onReactionChange
}: CommentReactionButtonProps) => {
  const { t } = useLanguage();
  const [liked, setLiked] = useState(false);
  const [likeCount, setLikeCount] = useState(initialReactionCount);
  const [loading, setLoading] = useState(false);

  useEffect(() => {
    const checkLiked = async () => {
      const { data: { user } } = await supabase.auth.getUser();
      if (user) {
        const likedComments = JSON.parse(localStorage.getItem('liked_comments') || '{}');
        setLiked(!!likedComments[commentId]);
      }
    };
    checkLiked();
  }, [commentId]);

  const handleLike = async () => {
    const { data: { user } } = await supabase.auth.getUser();
    
    if (!user) {
      toast.error(t('pleaseLoginToReact'));
      return;
    }

    setLoading(true);
    const newLiked = !liked;
    setLiked(newLiked);
    setLikeCount(prev => newLiked ? prev + 1 : Math.max(0, prev - 1));

    const likedComments = JSON.parse(localStorage.getItem('liked_comments') || '{}');
    if (newLiked) {
      likedComments[commentId] = true;
    } else {
      delete likedComments[commentId];
    }
    localStorage.setItem('liked_comments', JSON.stringify(likedComments));

    onReactionChange?.();
    setLoading(false);
  };

  return (
    <Button
      variant="ghost"
      size="sm"
      onClick={handleLike}
      disabled={loading}
      className={cn(
        "h-7 px-2 text-xs gap-1",
        liked && "text-red-500"
      )}
    >
      <Heart className={cn("w-3.5 h-3.5", liked && "fill-current")} />
      {likeCount > 0 && <span>{likeCount}</span>}
    </Button>
  );
};
