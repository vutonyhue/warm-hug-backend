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
    PostgrestVersion: "14.1"
  }
  public: {
    Tables: {
      comments: {
        Row: {
          content: string
          created_at: string | null
          id: string
          media_type: string | null
          media_url: string | null
          parent_id: string | null
          post_id: string
          updated_at: string | null
          user_id: string
        }
        Insert: {
          content: string
          created_at?: string | null
          id?: string
          media_type?: string | null
          media_url?: string | null
          parent_id?: string | null
          post_id: string
          updated_at?: string | null
          user_id: string
        }
        Update: {
          content?: string
          created_at?: string | null
          id?: string
          media_type?: string | null
          media_url?: string | null
          parent_id?: string | null
          post_id?: string
          updated_at?: string | null
          user_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "comments_parent_id_fkey"
            columns: ["parent_id"]
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
        ]
      }
      friendships: {
        Row: {
          addressee_id: string
          created_at: string | null
          id: string
          requester_id: string
          status: string | null
          updated_at: string | null
        }
        Insert: {
          addressee_id: string
          created_at?: string | null
          id?: string
          requester_id: string
          status?: string | null
          updated_at?: string | null
        }
        Update: {
          addressee_id?: string
          created_at?: string | null
          id?: string
          requester_id?: string
          status?: string | null
          updated_at?: string | null
        }
        Relationships: []
      }
      notifications: {
        Row: {
          actor_id: string | null
          comment_id: string | null
          created_at: string | null
          data: Json | null
          id: string
          message: string | null
          post_id: string | null
          read: boolean | null
          title: string | null
          type: string
          user_id: string
        }
        Insert: {
          actor_id?: string | null
          comment_id?: string | null
          created_at?: string | null
          data?: Json | null
          id?: string
          message?: string | null
          post_id?: string | null
          read?: boolean | null
          title?: string | null
          type: string
          user_id: string
        }
        Update: {
          actor_id?: string | null
          comment_id?: string | null
          created_at?: string | null
          data?: Json | null
          id?: string
          message?: string | null
          post_id?: string | null
          read?: boolean | null
          title?: string | null
          type?: string
          user_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "notifications_comment_id_fkey"
            columns: ["comment_id"]
            isOneToOne: false
            referencedRelation: "comments"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "notifications_post_id_fkey"
            columns: ["post_id"]
            isOneToOne: false
            referencedRelation: "posts"
            referencedColumns: ["id"]
          },
        ]
      }
      post_tags: {
        Row: {
          created_at: string | null
          id: string
          post_id: string
          tagged_user_id: string
        }
        Insert: {
          created_at?: string | null
          id?: string
          post_id: string
          tagged_user_id: string
        }
        Update: {
          created_at?: string | null
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
          activity: string | null
          content: string | null
          created_at: string | null
          feeling: string | null
          id: string
          image_url: string | null
          location: string | null
          media_urls: Json | null
          original_post_id: string | null
          privacy: string | null
          share_content: string | null
          updated_at: string | null
          user_id: string
          video_url: string | null
        }
        Insert: {
          activity?: string | null
          content?: string | null
          created_at?: string | null
          feeling?: string | null
          id?: string
          image_url?: string | null
          location?: string | null
          media_urls?: Json | null
          original_post_id?: string | null
          privacy?: string | null
          share_content?: string | null
          updated_at?: string | null
          user_id: string
          video_url?: string | null
        }
        Update: {
          activity?: string | null
          content?: string | null
          created_at?: string | null
          feeling?: string | null
          id?: string
          image_url?: string | null
          location?: string | null
          media_urls?: Json | null
          original_post_id?: string | null
          privacy?: string | null
          share_content?: string | null
          updated_at?: string | null
          user_id?: string
          video_url?: string | null
        }
        Relationships: []
      }
      profiles: {
        Row: {
          approved_reward: number | null
          avatar_url: string | null
          bio: string | null
          cover_url: string | null
          created_at: string | null
          custodial_wallet_address: string | null
          default_wallet_type: string | null
          external_wallet_address: string | null
          full_name: string | null
          fun_id: string | null
          grand_total_bet: number | null
          grand_total_deposit: number | null
          grand_total_loss: number | null
          grand_total_profit: number | null
          grand_total_win: number | null
          grand_total_withdraw: number | null
          id: string
          is_banned: boolean | null
          is_restricted: boolean | null
          last_login_at: string | null
          law_of_light_accepted: boolean | null
          oauth_provider: string | null
          pending_reward: number | null
          pinned_post_id: string | null
          registered_from: string | null
          reward_status: string | null
          soul_level: number | null
          total_rewards: number | null
          updated_at: string | null
          username: string | null
          wallet_address: string | null
        }
        Insert: {
          approved_reward?: number | null
          avatar_url?: string | null
          bio?: string | null
          cover_url?: string | null
          created_at?: string | null
          custodial_wallet_address?: string | null
          default_wallet_type?: string | null
          external_wallet_address?: string | null
          full_name?: string | null
          fun_id?: string | null
          grand_total_bet?: number | null
          grand_total_deposit?: number | null
          grand_total_loss?: number | null
          grand_total_profit?: number | null
          grand_total_win?: number | null
          grand_total_withdraw?: number | null
          id: string
          is_banned?: boolean | null
          is_restricted?: boolean | null
          last_login_at?: string | null
          law_of_light_accepted?: boolean | null
          oauth_provider?: string | null
          pending_reward?: number | null
          pinned_post_id?: string | null
          registered_from?: string | null
          reward_status?: string | null
          soul_level?: number | null
          total_rewards?: number | null
          updated_at?: string | null
          username?: string | null
          wallet_address?: string | null
        }
        Update: {
          approved_reward?: number | null
          avatar_url?: string | null
          bio?: string | null
          cover_url?: string | null
          created_at?: string | null
          custodial_wallet_address?: string | null
          default_wallet_type?: string | null
          external_wallet_address?: string | null
          full_name?: string | null
          fun_id?: string | null
          grand_total_bet?: number | null
          grand_total_deposit?: number | null
          grand_total_loss?: number | null
          grand_total_profit?: number | null
          grand_total_win?: number | null
          grand_total_withdraw?: number | null
          id?: string
          is_banned?: boolean | null
          is_restricted?: boolean | null
          last_login_at?: string | null
          law_of_light_accepted?: boolean | null
          oauth_provider?: string | null
          pending_reward?: number | null
          pinned_post_id?: string | null
          registered_from?: string | null
          reward_status?: string | null
          soul_level?: number | null
          total_rewards?: number | null
          updated_at?: string | null
          username?: string | null
          wallet_address?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "fk_pinned_post"
            columns: ["pinned_post_id"]
            isOneToOne: false
            referencedRelation: "posts"
            referencedColumns: ["id"]
          },
        ]
      }
      reactions: {
        Row: {
          created_at: string | null
          id: string
          post_id: string
          reaction_type: string
          user_id: string
        }
        Insert: {
          created_at?: string | null
          id?: string
          post_id: string
          reaction_type?: string
          user_id: string
        }
        Update: {
          created_at?: string | null
          id?: string
          post_id?: string
          reaction_type?: string
          user_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "reactions_post_id_fkey"
            columns: ["post_id"]
            isOneToOne: false
            referencedRelation: "posts"
            referencedColumns: ["id"]
          },
        ]
      }
      shared_posts: {
        Row: {
          content: string | null
          created_at: string | null
          id: string
          original_post_id: string
          privacy: string | null
          user_id: string
        }
        Insert: {
          content?: string | null
          created_at?: string | null
          id?: string
          original_post_id: string
          privacy?: string | null
          user_id: string
        }
        Update: {
          content?: string | null
          created_at?: string | null
          id?: string
          original_post_id?: string
          privacy?: string | null
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
      user_roles: {
        Row: {
          created_at: string | null
          id: string
          role: Database["public"]["Enums"]["app_role"]
          user_id: string
        }
        Insert: {
          created_at?: string | null
          id?: string
          role?: Database["public"]["Enums"]["app_role"]
          user_id: string
        }
        Update: {
          created_at?: string | null
          id?: string
          role?: Database["public"]["Enums"]["app_role"]
          user_id?: string
        }
        Relationships: []
      }
    }
    Views: {
      [_ in never]: never
    }
    Functions: {
      [_ in never]: never
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
