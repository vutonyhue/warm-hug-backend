/**
 * Common Types
 * Shared type definitions used across all modules
 */

/**
 * Generic API response wrapper
 */
export interface ApiResponse<T> {
  data: T | null;
  error: string | null;
  success: boolean;
}

/**
 * Pagination params
 */
export interface PaginationParams {
  page?: number;
  limit?: number;
  cursor?: string;
}

/**
 * Paginated response
 */
export interface PaginatedResponse<T> {
  data: T[];
  total: number;
  hasMore: boolean;
  nextCursor?: string;
}

/**
 * Loading state
 */
export type LoadingState = 'idle' | 'loading' | 'success' | 'error';

/**
 * User profile minimal info (for display in lists, comments, etc.)
 */
export interface UserProfileMinimal {
  id: string;
  username: string | null;
  avatar_url: string | null;
  full_name?: string | null;
}

/**
 * Timestamp fields
 */
export interface Timestamps {
  created_at: string;
  updated_at?: string;
}

/**
 * Base entity with ID and timestamps
 */
export interface BaseEntity extends Timestamps {
  id: string;
}

/**
 * File upload result
 */
export interface UploadResult {
  url: string;
  type: 'image' | 'video';
  size?: number;
  duration?: number; // for videos
}

/**
 * Toast notification type
 */
export type ToastType = 'success' | 'error' | 'warning' | 'info';

/**
 * Generic callback types
 */
export type VoidCallback = () => void;
export type AsyncVoidCallback = () => Promise<void>;
export type ValueCallback<T> = (value: T) => void;
export type AsyncValueCallback<T> = (value: T) => Promise<void>;
