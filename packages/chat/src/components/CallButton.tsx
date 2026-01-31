import { Phone, Video, Loader2 } from 'lucide-react';
import { cn } from '../utils/cn';

interface CallButtonProps {
  callType: 'video' | 'audio';
  onClick: () => void;
  disabled?: boolean;
  isLoading?: boolean;
  className?: string;
}

export function CallButton({ 
  callType, 
  onClick, 
  disabled = false,
  isLoading = false,
  className,
}: CallButtonProps) {
  const Icon = callType === 'video' ? Video : Phone;

  return (
    <button 
      onClick={onClick}
      disabled={disabled || isLoading}
      className={cn(
        "p-2 rounded-full transition-colors",
        "hover:bg-accent disabled:opacity-50 disabled:cursor-not-allowed",
        className
      )}
      title={callType === 'video' ? 'Gọi video' : 'Gọi thoại'}
    >
      {isLoading ? (
        <Loader2 className="h-5 w-5 animate-spin" />
      ) : (
        <Icon className="h-5 w-5" />
      )}
    </button>
  );
}
