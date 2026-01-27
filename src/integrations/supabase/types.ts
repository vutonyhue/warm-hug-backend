export type Json =
  | string
  | number
  | boolean
  | null
  | { [key: string]: Json | undefined }
  | Json[]

export type Database = {
  // Allows to automatically instantiate createClient with right options
  // instead of createClient<Database, { PostgrestVersion: 'XX' }>(URL, KEY)
  __InternalSupabase: {
    PostgrestVersion: "13.0.5"
  }
  public: {
    Tables: {
      account_merge_requests: {
        Row: {
          admin_note: string | null
          auto_provisioned: boolean | null
          created_at: string
          email: string
          id: string
          merge_type: string
          platform_data: Json | null
          provision_status: string | null
          reviewed_at: string | null
          reviewed_by: string | null
          source_platform: string
          source_user_id: string | null
          source_username: string | null
          status: string
          target_platform: string
          target_user_id: string | null
          updated_at: string
          webhook_sent: boolean | null
          webhook_sent_at: string | null
        }
        Insert: {
          admin_note?: string | null
          auto_provisioned?: boolean | null
          created_at?: string
          email: string
          id?: string
          merge_type: string
          platform_data?: Json | null
          provision_status?: string | null
          reviewed_at?: string | null
          reviewed_by?: string | null
          source_platform: string
          source_user_id?: string | null
          source_username?: string | null
          status?: string
          target_platform?: string
          target_user_id?: string | null
          updated_at?: string
          webhook_sent?: boolean | null
          webhook_sent_at?: string | null
        }
        Update: {
          admin_note?: string | null
          auto_provisioned?: boolean | null
          created_at?: string
          email?: string
          id?: string
          merge_type?: string
          platform_data?: Json | null
          provision_status?: string | null
          reviewed_at?: string | null
          reviewed_by?: string | null
          source_platform?: string
          source_user_id?: string | null
          source_username?: string | null
          status?: string
          target_platform?: string
          target_user_id?: string | null
          updated_at?: string
          webhook_sent?: boolean | null
          webhook_sent_at?: string | null
        }
        Relationships: []
      }
      audit_logs: {
        Row: {
          action: string
          admin_id: string
          created_at: string
          details: Json | null
          id: string
          reason: string | null
          target_user_id: string | null
        }
        Insert: {
          action: string
          admin_id: string
          created_at?: string
          details?: Json | null
          id?: string
          reason?: string | null
          target_user_id?: string | null
        }
        Update: {
          action?: string
          admin_id?: string
          created_at?: string
          details?: Json | null
          id?: string
          reason?: string | null
          target_user_id?: string | null
        }
        Relationships: []
      }
      blacklisted_wallets: {
        Row: {
          created_at: string
          created_by: string | null
          id: string
          is_permanent: boolean
          reason: string
          user_id: string | null
          wallet_address: string
        }
        Insert: {
          created_at?: string
          created_by?: string | null
          id?: string
          is_permanent?: boolean
          reason?: string
          user_id?: string | null
          wallet_address: string
        }
        Update: {
          created_at?: string
          created_by?: string | null
          id?: string
          is_permanent?: boolean
          reason?: string
          user_id?: string | null
          wallet_address?: string
        }
        Relationships: []
      }
      chat_settings: {
        Row: {
          created_at: string | null
          id: string
          show_read_receipts: boolean | null
          show_typing_indicator: boolean | null
          updated_at: string | null
          user_id: string
          who_can_message: string | null
        }
        Insert: {
          created_at?: string | null
          id?: string
          show_read_receipts?: boolean | null
          show_typing_indicator?: boolean | null
          updated_at?: string | null
          user_id: string
          who_can_message?: string | null
        }
        Update: {
          created_at?: string | null
          id?: string
          show_read_receipts?: boolean | null
          show_typing_indicator?: boolean | null
          updated_at?: string | null
          user_id?: string
          who_can_message?: string | null
        }
        Relationships: []
      }
      comments: {
        Row: {
          content: string
          created_at: string
          id: string
          image_url: string | null
          parent_comment_id: string | null
          post_id: string
          user_id: string
          video_url: string | null
        }
        Insert: {
          content: string
          created_at?: string
          id?: string
          image_url?: string | null
          parent_comment_id?: string | null
          post_id: string
          user_id: string
          video_url?: string | null
        }
        Update: {
          content?: string
          created_at?: string
          id?: string
          image_url?: string | null
          parent_comment_id?: string | null
          post_id?: string
          user_id?: string
          video_url?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "comments_parent_comment_id_fkey"
            columns: ["parent_comment_id"]
            isOneToOne: false
            referencedRelation: "comments"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "comments_post_id_fkey"
            columns: ["post_id"]
            isOneToOne: false
            referencedRelation: "posts"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "comments_user_id_fkey"
            columns: ["user_id"]
            isOneToOne: false
            referencedRelation: "profiles"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "comments_user_id_fkey"
            columns: ["user_id"]
            isOneToOne: false
            referencedRelation: "public_profiles"
            referencedColumns: ["id"]
          },
        ]
      }
      conversation_participants: {
        Row: {
          conversation_id: string
          id: string
          joined_at: string | null
          last_read_at: string | null
          left_at: string | null
          muted_until: string | null
          nickname: string | null
          role: string | null
          user_id: string
        }
        Insert: {
          conversation_id: string
          id?: string
          joined_at?: string | null
          last_read_at?: string | null
          left_at?: string | null
          muted_until?: string | null
          nickname?: string | null
          role?: string | null
          user_id: string
        }
        Update: {
          conversation_id?: string
          id?: string
          joined_at?: string | null
          last_read_at?: string | null
          left_at?: string | null
          muted_until?: string | null
          nickname?: string | null
          role?: string | null
          user_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "conversation_participants_conversation_id_fkey"
            columns: ["conversation_id"]
            isOneToOne: false
            referencedRelation: "conversations"
            referencedColumns: ["id"]
          },
        ]
      }
      conversations: {
        Row: {
          avatar_url: string | null
          created_at: string | null
          created_by: string | null
          id: string
          last_message_at: string | null
          last_message_preview: string | null
          name: string | null
          type: string
          updated_at: string | null
        }
        Insert: {
          avatar_url?: string | null
          created_at?: string | null
          created_by?: string | null
          id?: string
          last_message_at?: string | null
          last_message_preview?: string | null
          name?: string | null
          type?: string
          updated_at?: string | null
        }
        Update: {
          avatar_url?: string | null
          created_at?: string | null
          created_by?: string | null
          id?: string
          last_message_at?: string | null
          last_message_preview?: string | null
          name?: string | null
          type?: string
          updated_at?: string | null
        }
        Relationships: []
      }
      cross_platform_tokens: {
        Row: {
          access_token: string
          access_token_expires_at: string
          client_id: string
          created_at: string
          device_info: Json | null
          id: string
          is_revoked: boolean
          last_used_at: string | null
          refresh_token: string
          refresh_token_expires_at: string
          scope: string[]
          user_id: string
        }
        Insert: {
          access_token: string
          access_token_expires_at: string
          client_id: string
          created_at?: string
          device_info?: Json | null
          id?: string
          is_revoked?: boolean
          last_used_at?: string | null
          refresh_token: string
          refresh_token_expires_at: string
          scope?: string[]
          user_id: string
        }
        Update: {
          access_token?: string
          access_token_expires_at?: string
          client_id?: string
          created_at?: string
          device_info?: Json | null
          id?: string
          is_revoked?: boolean
          last_used_at?: string | null
          refresh_token?: string
          refresh_token_expires_at?: string
          scope?: string[]
          user_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "cross_platform_tokens_client_id_fkey"
            columns: ["client_id"]
            isOneToOne: false
            referencedRelation: "oauth_clients"
            referencedColumns: ["client_id"]
          },
          {
            foreignKeyName: "cross_platform_tokens_user_id_fkey"
            columns: ["user_id"]
            isOneToOne: false
            referencedRelation: "profiles"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "cross_platform_tokens_user_id_fkey"
            columns: ["user_id"]
            isOneToOne: false
            referencedRelation: "public_profiles"
            referencedColumns: ["id"]
          },
        ]
      }
      custodial_wallets: {
        Row: {
          chain_id: number
          created_at: string
          encrypted_private_key: string
          encryption_version: number
          id: string
          is_active: boolean
          last_activity_at: string | null
          updated_at: string
          user_id: string
          wallet_address: string
        }
        Insert: {
          chain_id?: number
          created_at?: string
          encrypted_private_key: string
          encryption_version?: number
          id?: string
          is_active?: boolean
          last_activity_at?: string | null
          updated_at?: string
          user_id: string
          wallet_address: string
        }
        Update: {
          chain_id?: number
          created_at?: string
          encrypted_private_key?: string
          encryption_version?: number
          id?: string
          is_active?: boolean
          last_activity_at?: string | null
          updated_at?: string
          user_id?: string
          wallet_address?: string
        }
        Relationships: [
          {
            foreignKeyName: "custodial_wallets_user_id_fkey"
            columns: ["user_id"]
            isOneToOne: true
            referencedRelation: "profiles"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "custodial_wallets_user_id_fkey"
            columns: ["user_id"]
            isOneToOne: true
            referencedRelation: "public_profiles"
            referencedColumns: ["id"]
          },
        ]
      }
      financial_transactions: {
        Row: {
          action: string
          amount: number
          client_id: string
          created_at: string
          currency: string
          id: string
          metadata: Json | null
          transaction_id: string
          user_id: string
        }
        Insert: {
          action: string
          amount: number
          client_id: string
          created_at?: string
          currency?: string
          id?: string
          metadata?: Json | null
          transaction_id: string
          user_id: string
        }
        Update: {
          action?: string
          amount?: number
          client_id?: string
          created_at?: string
          currency?: string
          id?: string
          metadata?: Json | null
          transaction_id?: string
          user_id?: string
        }
        Relationships: []
      }
      friendships: {
        Row: {
          created_at: string
          friend_id: string
          id: string
          status: string
          updated_at: string
          user_id: string
        }
        Insert: {
          created_at?: string
          friend_id: string
          id?: string
          status?: string
          updated_at?: string
          user_id: string
        }
        Update: {
          created_at?: string
          friend_id?: string
          id?: string
          status?: string
          updated_at?: string
          user_id?: string
        }
        Relationships: []
      }
      livestreams: {
        Row: {
          created_at: string | null
          duration_minutes: number | null
          ended_at: string | null
          id: string
          is_eligible: boolean | null
          started_at: string
          stream_id: string | null
          title: string | null
          user_id: string
        }
        Insert: {
          created_at?: string | null
          duration_minutes?: number | null
          ended_at?: string | null
          id?: string
          is_eligible?: boolean | null
          started_at?: string
          stream_id?: string | null
          title?: string | null
          user_id: string
        }
        Update: {
          created_at?: string | null
          duration_minutes?: number | null
          ended_at?: string | null
          id?: string
          is_eligible?: boolean | null
          started_at?: string
          stream_id?: string | null
          title?: string | null
          user_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "livestreams_user_id_fkey"
            columns: ["user_id"]
            isOneToOne: false
            referencedRelation: "profiles"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "livestreams_user_id_fkey"
            columns: ["user_id"]
            isOneToOne: false
            referencedRelation: "public_profiles"
            referencedColumns: ["id"]
          },
        ]
      }
      message_reactions: {
        Row: {
          created_at: string | null
          emoji: string
          id: string
          message_id: string
          user_id: string
        }
        Insert: {
          created_at?: string | null
          emoji: string
          id?: string
          message_id: string
          user_id: string
        }
        Update: {
          created_at?: string | null
          emoji?: string
          id?: string
          message_id?: string
          user_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "message_reactions_message_id_fkey"
            columns: ["message_id"]
            isOneToOne: false
            referencedRelation: "messages"
            referencedColumns: ["id"]
          },
        ]
      }
      message_reads: {
        Row: {
          id: string
          message_id: string
          read_at: string | null
          user_id: string
        }
        Insert: {
          id?: string
          message_id: string
          read_at?: string | null
          user_id: string
        }
        Update: {
          id?: string
          message_id?: string
          read_at?: string | null
          user_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "message_reads_message_id_fkey"
            columns: ["message_id"]
            isOneToOne: false
            referencedRelation: "messages"
            referencedColumns: ["id"]
          },
        ]
      }
      messages: {
        Row: {
          content: string | null
          conversation_id: string
          created_at: string | null
          deleted_at: string | null
          id: string
          is_deleted: boolean | null
          media_urls: Json | null
          reply_to_id: string | null
          sender_id: string
          updated_at: string | null
        }
        Insert: {
          content?: string | null
          conversation_id: string
          created_at?: string | null
          deleted_at?: string | null
          id?: string
          is_deleted?: boolean | null
          media_urls?: Json | null
          reply_to_id?: string | null
          sender_id: string
          updated_at?: string | null
        }
        Update: {
          content?: string | null
          conversation_id?: string
          created_at?: string | null
          deleted_at?: string | null
          id?: string
          is_deleted?: boolean | null
          media_urls?: Json | null
          reply_to_id?: string | null
          sender_id?: string
          updated_at?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "messages_conversation_id_fkey"
            columns: ["conversation_id"]
            isOneToOne: false
            referencedRelation: "conversations"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "messages_reply_to_id_fkey"
            columns: ["reply_to_id"]
            isOneToOne: false
            referencedRelation: "messages"
            referencedColumns: ["id"]
          },
        ]
      }
      notifications: {
        Row: {
          actor_id: string
          created_at: string
          id: string
          post_id: string | null
          read: boolean
          type: string
          user_id: string
        }
        Insert: {
          actor_id: string
          created_at?: string
          id?: string
          post_id?: string | null
          read?: boolean
          type: string
          user_id: string
        }
        Update: {
          actor_id?: string
          created_at?: string
          id?: string
          post_id?: string | null
          read?: boolean
          type?: string
          user_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "notifications_post_id_fkey"
            columns: ["post_id"]
            isOneToOne: false
            referencedRelation: "posts"
            referencedColumns: ["id"]
          },
        ]
      }
      oauth_clients: {
        Row: {
          allowed_scopes: string[]
          client_id: string
          client_name: string
          client_secret: string
          created_at: string
          description: string | null
          id: string
          is_active: boolean
          logo_url: string | null
          platform_name: string | null
          redirect_uris: string[]
          updated_at: string
          webhook_url: string | null
          website_url: string | null
        }
        Insert: {
          allowed_scopes?: string[]
          client_id: string
          client_name: string
          client_secret: string
          created_at?: string
          description?: string | null
          id?: string
          is_active?: boolean
          logo_url?: string | null
          platform_name?: string | null
          redirect_uris?: string[]
          updated_at?: string
          webhook_url?: string | null
          website_url?: string | null
        }
        Update: {
          allowed_scopes?: string[]
          client_id?: string
          client_name?: string
          client_secret?: string
          created_at?: string
          description?: string | null
          id?: string
          is_active?: boolean
          logo_url?: string | null
          platform_name?: string | null
          redirect_uris?: string[]
          updated_at?: string
          webhook_url?: string | null
          website_url?: string | null
        }
        Relationships: []
      }
      oauth_codes: {
        Row: {
          client_id: string
          code: string
          code_challenge: string | null
          code_challenge_method: string | null
          created_at: string
          expires_at: string
          id: string
          is_used: boolean
          redirect_uri: string
          scope: string[]
          user_id: string
        }
        Insert: {
          client_id: string
          code: string
          code_challenge?: string | null
          code_challenge_method?: string | null
          created_at?: string
          expires_at?: string
          id?: string
          is_used?: boolean
          redirect_uri: string
          scope?: string[]
          user_id: string
        }
        Update: {
          client_id?: string
          code?: string
          code_challenge?: string | null
          code_challenge_method?: string | null
          created_at?: string
          expires_at?: string
          id?: string
          is_used?: boolean
          redirect_uri?: string
          scope?: string[]
          user_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "oauth_codes_client_id_fkey"
            columns: ["client_id"]
            isOneToOne: false
            referencedRelation: "oauth_clients"
            referencedColumns: ["client_id"]
          },
          {
            foreignKeyName: "oauth_codes_user_id_fkey"
            columns: ["user_id"]
            isOneToOne: false
            referencedRelation: "profiles"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "oauth_codes_user_id_fkey"
            columns: ["user_id"]
            isOneToOne: false
            referencedRelation: "public_profiles"
            referencedColumns: ["id"]
          },
        ]
      }
      otp_codes: {
        Row: {
          attempts: number
          code: string
          created_at: string
          expires_at: string
          id: string
          identifier: string
          is_used: boolean
          max_attempts: number
          type: string
        }
        Insert: {
          attempts?: number
          code: string
          created_at?: string
          expires_at: string
          id?: string
          identifier: string
          is_used?: boolean
          max_attempts?: number
          type?: string
        }
        Update: {
          attempts?: number
          code?: string
          created_at?: string
          expires_at?: string
          id?: string
          identifier?: string
          is_used?: boolean
          max_attempts?: number
          type?: string
        }
        Relationships: []
      }
      pending_provisions: {
        Row: {
          completed_at: string | null
          created_at: string | null
          email: string
          fun_profile_id: string | null
          id: string
          merge_request_id: string | null
          password_token_hash: string
          platform_data: Json | null
          platform_id: string
          platform_user_id: string | null
          status: string | null
          token_expires_at: string
        }
        Insert: {
          completed_at?: string | null
          created_at?: string | null
          email: string
          fun_profile_id?: string | null
          id?: string
          merge_request_id?: string | null
          password_token_hash: string
          platform_data?: Json | null
          platform_id: string
          platform_user_id?: string | null
          status?: string | null
          token_expires_at: string
        }
        Update: {
          completed_at?: string | null
          created_at?: string | null
          email?: string
          fun_profile_id?: string | null
          id?: string
          merge_request_id?: string | null
          password_token_hash?: string
          platform_data?: Json | null
          platform_id?: string
          platform_user_id?: string | null
          status?: string | null
          token_expires_at?: string
        }
        Relationships: [
          {
            foreignKeyName: "pending_provisions_merge_request_id_fkey"
            columns: ["merge_request_id"]
            isOneToOne: false
            referencedRelation: "account_merge_requests"
            referencedColumns: ["id"]
          },
        ]
      }
      platform_financial_data: {
        Row: {
          client_id: string
          client_timestamp: string | null
          created_at: string
          id: string
          last_sync_at: string
          sync_count: number
          total_bet: number
          total_deposit: number
          total_loss: number
          total_profit: number
          total_win: number
          total_withdraw: number
          updated_at: string
          user_id: string
        }
        Insert: {
          client_id: string
          client_timestamp?: string | null
          created_at?: string
          id?: string
          last_sync_at?: string
          sync_count?: number
          total_bet?: number
          total_deposit?: number
          total_loss?: number
          total_profit?: number
          total_win?: number
          total_withdraw?: number
          updated_at?: string
          user_id: string
        }
        Update: {
          client_id?: string
          client_timestamp?: string | null
          created_at?: string
          id?: string
          last_sync_at?: string
          sync_count?: number
          total_bet?: number
          total_deposit?: number
          total_loss?: number
          total_profit?: number
          total_win?: number
          total_withdraw?: number
          updated_at?: string
          user_id?: string
        }
        Relationships: []
      }
      platform_user_data: {
        Row: {
          client_id: string
          client_timestamp: string | null
          created_at: string
          data: Json
          id: string
          last_sync_mode: string | null
          sync_count: number
          synced_at: string
          updated_at: string
          user_id: string
        }
        Insert: {
          client_id: string
          client_timestamp?: string | null
          created_at?: string
          data?: Json
          id?: string
          last_sync_mode?: string | null
          sync_count?: number
          synced_at?: string
          updated_at?: string
          user_id: string
        }
        Update: {
          client_id?: string
          client_timestamp?: string | null
          created_at?: string
          data?: Json
          id?: string
          last_sync_mode?: string | null
          sync_count?: number
          synced_at?: string
          updated_at?: string
          user_id?: string
        }
        Relationships: []
      }
      post_tags: {
        Row: {
          created_at: string
          id: string
          post_id: string
          tagged_user_id: string
        }
        Insert: {
          created_at?: string
          id?: string
          post_id: string
          tagged_user_id: string
        }
        Update: {
          created_at?: string
          id?: string
          post_id?: string
          tagged_user_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "post_tags_post_id_fkey"
            columns: ["post_id"]
            isOneToOne: false
            referencedRelation: "posts"
            referencedColumns: ["id"]
          },
        ]
      }
      posts: {
        Row: {
          content: string
          created_at: string
          id: string
          image_url: string | null
          location: string | null
          media_urls: Json | null
          updated_at: string
          user_id: string
          video_url: string | null
        }
        Insert: {
          content: string
          created_at?: string
          id?: string
          image_url?: string | null
          location?: string | null
          media_urls?: Json | null
          updated_at?: string
          user_id: string
          video_url?: string | null
        }
        Update: {
          content?: string
          created_at?: string
          id?: string
          image_url?: string | null
          location?: string | null
          media_urls?: Json | null
          updated_at?: string
          user_id?: string
          video_url?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "posts_user_id_fkey"
            columns: ["user_id"]
            isOneToOne: false
            referencedRelation: "profiles"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "posts_user_id_fkey"
            columns: ["user_id"]
            isOneToOne: false
            referencedRelation: "public_profiles"
            referencedColumns: ["id"]
          },
        ]
      }
      profiles: {
        Row: {
          admin_notes: string | null
          approved_reward: number
          avatar_url: string | null
          ban_reason: string | null
          banned_at: string | null
          bio: string | null
          cover_url: string | null
          created_at: string
          cross_platform_data: Json | null
          custodial_wallet_address: string | null
          default_wallet_type: string | null
          external_wallet_address: string | null
          financial_updated_at: string | null
          full_name: string | null
          fun_id: string | null
          grand_total_bet: number
          grand_total_deposit: number
          grand_total_loss: number
          grand_total_profit: number
          grand_total_win: number
          grand_total_withdraw: number
          id: string
          is_banned: boolean
          is_restricted: boolean
          last_login_platform: string | null
          law_of_light_accepted: boolean
          law_of_light_accepted_at: string | null
          oauth_provider: string | null
          pending_reward: number
          pinned_post_id: string | null
          registered_from: string | null
          reward_status: string
          soul_level: number
          total_rewards: number
          updated_at: string
          username: string
          wallet_address: string | null
        }
        Insert: {
          admin_notes?: string | null
          approved_reward?: number
          avatar_url?: string | null
          ban_reason?: string | null
          banned_at?: string | null
          bio?: string | null
          cover_url?: string | null
          created_at?: string
          cross_platform_data?: Json | null
          custodial_wallet_address?: string | null
          default_wallet_type?: string | null
          external_wallet_address?: string | null
          financial_updated_at?: string | null
          full_name?: string | null
          fun_id?: string | null
          grand_total_bet?: number
          grand_total_deposit?: number
          grand_total_loss?: number
          grand_total_profit?: number
          grand_total_win?: number
          grand_total_withdraw?: number
          id: string
          is_banned?: boolean
          is_restricted?: boolean
          last_login_platform?: string | null
          law_of_light_accepted?: boolean
          law_of_light_accepted_at?: string | null
          oauth_provider?: string | null
          pending_reward?: number
          pinned_post_id?: string | null
          registered_from?: string | null
          reward_status?: string
          soul_level?: number
          total_rewards?: number
          updated_at?: string
          username: string
          wallet_address?: string | null
        }
        Update: {
          admin_notes?: string | null
          approved_reward?: number
          avatar_url?: string | null
          ban_reason?: string | null
          banned_at?: string | null
          bio?: string | null
          cover_url?: string | null
          created_at?: string
          cross_platform_data?: Json | null
          custodial_wallet_address?: string | null
          default_wallet_type?: string | null
          external_wallet_address?: string | null
          financial_updated_at?: string | null
          full_name?: string | null
          fun_id?: string | null
          grand_total_bet?: number
          grand_total_deposit?: number
          grand_total_loss?: number
          grand_total_profit?: number
          grand_total_win?: number
          grand_total_withdraw?: number
          id?: string
          is_banned?: boolean
          is_restricted?: boolean
          last_login_platform?: string | null
          law_of_light_accepted?: boolean
          law_of_light_accepted_at?: string | null
          oauth_provider?: string | null
          pending_reward?: number
          pinned_post_id?: string | null
          registered_from?: string | null
          reward_status?: string
          soul_level?: number
          total_rewards?: number
          updated_at?: string
          username?: string
          wallet_address?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "profiles_pinned_post_id_fkey"
            columns: ["pinned_post_id"]
            isOneToOne: false
            referencedRelation: "posts"
            referencedColumns: ["id"]
          },
        ]
      }
      rate_limit_state: {
        Row: {
          count: number
          expires_at: string
          key: string
          window_start: string
        }
        Insert: {
          count?: number
          expires_at: string
          key: string
          window_start?: string
        }
        Update: {
          count?: number
          expires_at?: string
          key?: string
          window_start?: string
        }
        Relationships: []
      }
      reactions: {
        Row: {
          comment_id: string | null
          created_at: string
          id: string
          post_id: string | null
          type: string
          user_id: string
        }
        Insert: {
          comment_id?: string | null
          created_at?: string
          id?: string
          post_id?: string | null
          type?: string
          user_id: string
        }
        Update: {
          comment_id?: string | null
          created_at?: string
          id?: string
          post_id?: string | null
          type?: string
          user_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "reactions_comment_id_fkey"
            columns: ["comment_id"]
            isOneToOne: false
            referencedRelation: "comments"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "reactions_post_id_fkey"
            columns: ["post_id"]
            isOneToOne: false
            referencedRelation: "posts"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "reactions_user_id_fkey"
            columns: ["user_id"]
            isOneToOne: false
            referencedRelation: "profiles"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "reactions_user_id_fkey"
            columns: ["user_id"]
            isOneToOne: false
            referencedRelation: "public_profiles"
            referencedColumns: ["id"]
          },
        ]
      }
      reconciliation_logs: {
        Row: {
          auto_adjusted: boolean | null
          discrepancies: Json | null
          id: string
          level: number
          notes: string | null
          run_at: string
          run_by: string | null
          status: string
          total_checked: number | null
          total_mismatched: number | null
        }
        Insert: {
          auto_adjusted?: boolean | null
          discrepancies?: Json | null
          id?: string
          level?: number
          notes?: string | null
          run_at?: string
          run_by?: string | null
          status?: string
          total_checked?: number | null
          total_mismatched?: number | null
        }
        Update: {
          auto_adjusted?: boolean | null
          discrepancies?: Json | null
          id?: string
          level?: number
          notes?: string | null
          run_at?: string
          run_by?: string | null
          status?: string
          total_checked?: number | null
          total_mismatched?: number | null
        }
        Relationships: []
      }
      reward_adjustments: {
        Row: {
          admin_id: string
          amount: number
          created_at: string
          id: string
          reason: string
          user_id: string
        }
        Insert: {
          admin_id: string
          amount: number
          created_at?: string
          id?: string
          reason: string
          user_id: string
        }
        Update: {
          admin_id?: string
          amount?: number
          created_at?: string
          id?: string
          reason?: string
          user_id?: string
        }
        Relationships: []
      }
      reward_approvals: {
        Row: {
          admin_id: string
          admin_note: string | null
          amount: number
          created_at: string
          id: string
          reviewed_at: string | null
          status: string
          user_id: string
        }
        Insert: {
          admin_id: string
          admin_note?: string | null
          amount?: number
          created_at?: string
          id?: string
          reviewed_at?: string | null
          status?: string
          user_id: string
        }
        Update: {
          admin_id?: string
          admin_note?: string | null
          amount?: number
          created_at?: string
          id?: string
          reviewed_at?: string | null
          status?: string
          user_id?: string
        }
        Relationships: []
      }
      reward_claims: {
        Row: {
          amount: number
          created_at: string
          id: string
          user_id: string
          wallet_address: string
        }
        Insert: {
          amount: number
          created_at?: string
          id?: string
          user_id: string
          wallet_address: string
        }
        Update: {
          amount?: number
          created_at?: string
          id?: string
          user_id?: string
          wallet_address?: string
        }
        Relationships: []
      }
      search_logs: {
        Row: {
          created_at: string
          id: string
          search_query: string
          user_id: string
        }
        Insert: {
          created_at?: string
          id?: string
          search_query: string
          user_id: string
        }
        Update: {
          created_at?: string
          id?: string
          search_query?: string
          user_id?: string
        }
        Relationships: []
      }
      shared_posts: {
        Row: {
          created_at: string
          id: string
          original_post_id: string
          user_id: string
        }
        Insert: {
          created_at?: string
          id?: string
          original_post_id: string
          user_id: string
        }
        Update: {
          created_at?: string
          id?: string
          original_post_id?: string
          user_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "shared_posts_original_post_id_fkey"
            columns: ["original_post_id"]
            isOneToOne: false
            referencedRelation: "posts"
            referencedColumns: ["id"]
          },
        ]
      }
      soul_nfts: {
        Row: {
          chain_id: number
          contract_address: string | null
          created_at: string
          experience_points: number
          id: string
          is_minted: boolean
          metadata_uri: string | null
          minted_at: string | null
          soul_element: string | null
          soul_level: number
          soul_name: string | null
          token_id: string | null
          updated_at: string
          user_id: string
        }
        Insert: {
          chain_id?: number
          contract_address?: string | null
          created_at?: string
          experience_points?: number
          id?: string
          is_minted?: boolean
          metadata_uri?: string | null
          minted_at?: string | null
          soul_element?: string | null
          soul_level?: number
          soul_name?: string | null
          token_id?: string | null
          updated_at?: string
          user_id: string
        }
        Update: {
          chain_id?: number
          contract_address?: string | null
          created_at?: string
          experience_points?: number
          id?: string
          is_minted?: boolean
          metadata_uri?: string | null
          minted_at?: string | null
          soul_element?: string | null
          soul_level?: number
          soul_name?: string | null
          token_id?: string | null
          updated_at?: string
          user_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "soul_nfts_user_id_fkey"
            columns: ["user_id"]
            isOneToOne: true
            referencedRelation: "profiles"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "soul_nfts_user_id_fkey"
            columns: ["user_id"]
            isOneToOne: true
            referencedRelation: "public_profiles"
            referencedColumns: ["id"]
          },
        ]
      }
      transactions: {
        Row: {
          amount: string
          chain_id: number
          created_at: string
          from_address: string
          id: string
          status: string
          to_address: string
          token_address: string | null
          token_symbol: string
          tx_hash: string
          user_id: string
        }
        Insert: {
          amount: string
          chain_id: number
          created_at?: string
          from_address: string
          id?: string
          status?: string
          to_address: string
          token_address?: string | null
          token_symbol: string
          tx_hash: string
          user_id: string
        }
        Update: {
          amount?: string
          chain_id?: number
          created_at?: string
          from_address?: string
          id?: string
          status?: string
          to_address?: string
          token_address?: string | null
          token_symbol?: string
          tx_hash?: string
          user_id?: string
        }
        Relationships: []
      }
      user_roles: {
        Row: {
          id: string
          role: Database["public"]["Enums"]["app_role"]
          user_id: string
        }
        Insert: {
          id?: string
          role?: Database["public"]["Enums"]["app_role"]
          user_id: string
        }
        Update: {
          id?: string
          role?: Database["public"]["Enums"]["app_role"]
          user_id?: string
        }
        Relationships: []
      }
    }
    Views: {
      public_profiles: {
        Row: {
          avatar_url: string | null
          bio: string | null
          cover_url: string | null
          created_at: string | null
          full_name: string | null
          id: string | null
          username: string | null
        }
        Insert: {
          avatar_url?: string | null
          bio?: string | null
          cover_url?: string | null
          created_at?: string | null
          full_name?: string | null
          id?: string | null
          username?: string | null
        }
        Update: {
          avatar_url?: string | null
          bio?: string | null
          cover_url?: string | null
          created_at?: string | null
          full_name?: string | null
          id?: string | null
          username?: string | null
        }
        Relationships: []
      }
      user_custodial_wallets: {
        Row: {
          chain_id: number | null
          created_at: string | null
          id: string | null
          is_active: boolean | null
          last_activity_at: string | null
          updated_at: string | null
          user_id: string | null
          wallet_address: string | null
        }
        Insert: {
          chain_id?: number | null
          created_at?: string | null
          id?: string | null
          is_active?: boolean | null
          last_activity_at?: string | null
          updated_at?: string | null
          user_id?: string | null
          wallet_address?: string | null
        }
        Update: {
          chain_id?: number | null
          created_at?: string | null
          id?: string | null
          is_active?: boolean | null
          last_activity_at?: string | null
          updated_at?: string | null
          user_id?: string | null
          wallet_address?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "custodial_wallets_user_id_fkey"
            columns: ["user_id"]
            isOneToOne: true
            referencedRelation: "profiles"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "custodial_wallets_user_id_fkey"
            columns: ["user_id"]
            isOneToOne: true
            referencedRelation: "public_profiles"
            referencedColumns: ["id"]
          },
        ]
      }
    }
    Functions: {
      approve_user_reward: {
        Args: { p_admin_id: string; p_note?: string; p_user_id: string }
        Returns: number
      }
      ban_user_permanently: {
        Args: { p_admin_id: string; p_reason?: string; p_user_id: string }
        Returns: boolean
      }
      check_rate_limit: {
        Args: { p_key: string; p_limit: number; p_window_ms?: number }
        Returns: Json
      }
      cleanup_expired_oauth_data: { Args: never; Returns: undefined }
      delete_storage_object: {
        Args: { bucket_name: string; object_path: string }
        Returns: undefined
      }
      end_livestream: { Args: { p_livestream_id: string }; Returns: boolean }
      generate_secure_token: { Args: { length?: number }; Returns: string }
      get_app_stats: {
        Args: never
        Returns: {
          total_photos: number
          total_posts: number
          total_rewards: number
          total_users: number
          total_videos: number
        }[]
      }
      get_user_rewards: {
        Args: { limit_count?: number }
        Returns: {
          avatar_url: string
          comments_count: number
          friends_count: number
          id: string
          posts_count: number
          reactions_count: number
          reactions_on_posts: number
          shares_count: number
          total_reward: number
          username: string
        }[]
      }
      get_user_rewards_v2: {
        Args: { limit_count?: number }
        Returns: {
          avatar_url: string
          comments_count: number
          friends_count: number
          id: string
          livestreams_count: number
          posts_count: number
          reactions_count: number
          reactions_on_posts: number
          shares_count: number
          today_reward: number
          total_reward: number
          username: string
        }[]
      }
      has_role: {
        Args: {
          _role: Database["public"]["Enums"]["app_role"]
          _user_id: string
        }
        Returns: boolean
      }
      is_conversation_admin: {
        Args: { check_user_id: string; conv_id: string }
        Returns: boolean
      }
      is_conversation_participant: {
        Args: { check_user_id: string; conv_id: string }
        Returns: boolean
      }
      normalize_username: { Args: { input_text: string }; Returns: string }
      recalculate_user_financial:
        | { Args: { p_client_id?: string; p_user_id: string }; Returns: Json }
        | {
            Args: {
              p_admin_id?: string
              p_client_id?: string
              p_user_id: string
            }
            Returns: Json
          }
      reject_user_reward: {
        Args: { p_admin_id: string; p_note?: string; p_user_id: string }
        Returns: number
      }
      run_financial_reconciliation: {
        Args: { p_admin_id?: string }
        Returns: Json
      }
    }
    Enums: {
      app_role: "admin" | "user"
    }
    CompositeTypes: {
      [_ in never]: never
    }
  }
}

type DatabaseWithoutInternals = Omit<Database, "__InternalSupabase">

type DefaultSchema = DatabaseWithoutInternals[Extract<keyof Database, "public">]

export type Tables<
  DefaultSchemaTableNameOrOptions extends
    | keyof (DefaultSchema["Tables"] & DefaultSchema["Views"])
    | { schema: keyof DatabaseWithoutInternals },
  TableName extends DefaultSchemaTableNameOrOptions extends {
    schema: keyof DatabaseWithoutInternals
  }
    ? keyof (DatabaseWithoutInternals[DefaultSchemaTableNameOrOptions["schema"]]["Tables"] &
        DatabaseWithoutInternals[DefaultSchemaTableNameOrOptions["schema"]]["Views"])
    : never = never,
> = DefaultSchemaTableNameOrOptions extends {
  schema: keyof DatabaseWithoutInternals
}
  ? (DatabaseWithoutInternals[DefaultSchemaTableNameOrOptions["schema"]]["Tables"] &
      DatabaseWithoutInternals[DefaultSchemaTableNameOrOptions["schema"]]["Views"])[TableName] extends {
      Row: infer R
    }
    ? R
    : never
  : DefaultSchemaTableNameOrOptions extends keyof (DefaultSchema["Tables"] &
        DefaultSchema["Views"])
    ? (DefaultSchema["Tables"] &
        DefaultSchema["Views"])[DefaultSchemaTableNameOrOptions] extends {
        Row: infer R
      }
      ? R
      : never
    : never

export type TablesInsert<
  DefaultSchemaTableNameOrOptions extends
    | keyof DefaultSchema["Tables"]
    | { schema: keyof DatabaseWithoutInternals },
  TableName extends DefaultSchemaTableNameOrOptions extends {
    schema: keyof DatabaseWithoutInternals
  }
    ? keyof DatabaseWithoutInternals[DefaultSchemaTableNameOrOptions["schema"]]["Tables"]
    : never = never,
> = DefaultSchemaTableNameOrOptions extends {
  schema: keyof DatabaseWithoutInternals
}
  ? DatabaseWithoutInternals[DefaultSchemaTableNameOrOptions["schema"]]["Tables"][TableName] extends {
      Insert: infer I
    }
    ? I
    : never
  : DefaultSchemaTableNameOrOptions extends keyof DefaultSchema["Tables"]
    ? DefaultSchema["Tables"][DefaultSchemaTableNameOrOptions] extends {
        Insert: infer I
      }
      ? I
      : never
    : never

export type TablesUpdate<
  DefaultSchemaTableNameOrOptions extends
    | keyof DefaultSchema["Tables"]
    | { schema: keyof DatabaseWithoutInternals },
  TableName extends DefaultSchemaTableNameOrOptions extends {
    schema: keyof DatabaseWithoutInternals
  }
    ? keyof DatabaseWithoutInternals[DefaultSchemaTableNameOrOptions["schema"]]["Tables"]
    : never = never,
> = DefaultSchemaTableNameOrOptions extends {
  schema: keyof DatabaseWithoutInternals
}
  ? DatabaseWithoutInternals[DefaultSchemaTableNameOrOptions["schema"]]["Tables"][TableName] extends {
      Update: infer U
    }
    ? U
    : never
  : DefaultSchemaTableNameOrOptions extends keyof DefaultSchema["Tables"]
    ? DefaultSchema["Tables"][DefaultSchemaTableNameOrOptions] extends {
        Update: infer U
      }
      ? U
      : never
    : never

export type Enums<
  DefaultSchemaEnumNameOrOptions extends
    | keyof DefaultSchema["Enums"]
    | { schema: keyof DatabaseWithoutInternals },
  EnumName extends DefaultSchemaEnumNameOrOptions extends {
    schema: keyof DatabaseWithoutInternals
  }
    ? keyof DatabaseWithoutInternals[DefaultSchemaEnumNameOrOptions["schema"]]["Enums"]
    : never = never,
> = DefaultSchemaEnumNameOrOptions extends {
  schema: keyof DatabaseWithoutInternals
}
  ? DatabaseWithoutInternals[DefaultSchemaEnumNameOrOptions["schema"]]["Enums"][EnumName]
  : DefaultSchemaEnumNameOrOptions extends keyof DefaultSchema["Enums"]
    ? DefaultSchema["Enums"][DefaultSchemaEnumNameOrOptions]
    : never

export type CompositeTypes<
  PublicCompositeTypeNameOrOptions extends
    | keyof DefaultSchema["CompositeTypes"]
    | { schema: keyof DatabaseWithoutInternals },
  CompositeTypeName extends PublicCompositeTypeNameOrOptions extends {
    schema: keyof DatabaseWithoutInternals
  }
    ? keyof DatabaseWithoutInternals[PublicCompositeTypeNameOrOptions["schema"]]["CompositeTypes"]
    : never = never,
> = PublicCompositeTypeNameOrOptions extends {
  schema: keyof DatabaseWithoutInternals
}
  ? DatabaseWithoutInternals[PublicCompositeTypeNameOrOptions["schema"]]["CompositeTypes"][CompositeTypeName]
  : PublicCompositeTypeNameOrOptions extends keyof DefaultSchema["CompositeTypes"]
    ? DefaultSchema["CompositeTypes"][PublicCompositeTypeNameOrOptions]
    : never

export const Constants = {
  public: {
    Enums: {
      app_role: ["admin", "user"],
    },
  },
} as const
