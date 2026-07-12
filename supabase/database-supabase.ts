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
    PostgrestVersion: "12.2.3 (519615d)"
  }
  graphql_public: {
    Tables: {
      [_ in never]: never
    }
    Views: {
      [_ in never]: never
    }
    Functions: {
      graphql: {
        Args: {
          extensions?: Json
          operationName?: string
          query?: string
          variables?: Json
        }
        Returns: Json
      }
    }
    Enums: {
      [_ in never]: never
    }
    CompositeTypes: {
      [_ in never]: never
    }
  }
  public: {
    Tables: {
      _prisma_migrations: {
        Row: {
          applied_steps_count: number
          checksum: string
          finished_at: string | null
          id: string
          logs: string | null
          migration_name: string
          rolled_back_at: string | null
          started_at: string
        }
        Insert: {
          applied_steps_count?: number
          checksum: string
          finished_at?: string | null
          id: string
          logs?: string | null
          migration_name: string
          rolled_back_at?: string | null
          started_at?: string
        }
        Update: {
          applied_steps_count?: number
          checksum?: string
          finished_at?: string | null
          id?: string
          logs?: string | null
          migration_name?: string
          rolled_back_at?: string | null
          started_at?: string
        }
        Relationships: []
      }
      activitypub_keys: {
        Row: {
          created_at: string
          private_pem: string
          public_pem: string
          updated_at: string
          user_id: number
        }
        Insert: {
          created_at?: string
          private_pem: string
          public_pem: string
          updated_at?: string
          user_id: number
        }
        Update: {
          created_at?: string
          private_pem?: string
          public_pem?: string
          updated_at?: string
          user_id?: number
        }
        Relationships: [
          {
            foreignKeyName: "activitypub_keys_user_id_fkey"
            columns: ["user_id"]
            isOneToOne: true
            referencedRelation: "users"
            referencedColumns: ["id"]
          },
        ]
      }
      annotations: {
        Row: {
          author_id: number
          created_at: string
          id: string
          page: number
          post_id: string
          rect: Json
          text: string
        }
        Insert: {
          author_id: number
          created_at?: string
          id: string
          page: number
          post_id: string
          rect: Json
          text: string
        }
        Update: {
          author_id?: number
          created_at?: string
          id?: string
          page?: number
          post_id?: string
          rect?: Json
          text?: string
        }
        Relationships: [
          {
            foreignKeyName: "annotations_author_id_fkey"
            columns: ["author_id"]
            isOneToOne: false
            referencedRelation: "users"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "annotations_post_id_fkey"
            columns: ["post_id"]
            isOneToOne: false
            referencedRelation: "library_posts"
            referencedColumns: ["id"]
          },
        ]
      }
      ap_domain_rules: {
        Row: {
          created_at: string
          domain: string
          id: number
          mode: Database["public"]["Enums"]["ApDomainRuleMode"]
        }
        Insert: {
          created_at?: string
          domain: string
          id?: number
          mode: Database["public"]["Enums"]["ApDomainRuleMode"]
        }
        Update: {
          created_at?: string
          domain?: string
          id?: number
          mode?: Database["public"]["Enums"]["ApDomainRuleMode"]
        }
        Relationships: []
      }
      ap_followers: {
        Row: {
          accepted_at: string | null
          created_at: string
          id: number
          remote_actor_id: number
          state: Database["public"]["Enums"]["ApFollowState"]
          user_id: number
        }
        Insert: {
          accepted_at?: string | null
          created_at?: string
          id?: number
          remote_actor_id: number
          state?: Database["public"]["Enums"]["ApFollowState"]
          user_id: number
        }
        Update: {
          accepted_at?: string | null
          created_at?: string
          id?: number
          remote_actor_id?: number
          state?: Database["public"]["Enums"]["ApFollowState"]
          user_id?: number
        }
        Relationships: [
          {
            foreignKeyName: "ap_followers_remote_actor_id_fkey"
            columns: ["remote_actor_id"]
            isOneToOne: false
            referencedRelation: "ap_remote_actors"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "ap_followers_user_id_fkey"
            columns: ["user_id"]
            isOneToOne: false
            referencedRelation: "users"
            referencedColumns: ["id"]
          },
        ]
      }
      ap_following: {
        Row: {
          accepted_at: string | null
          created_at: string
          id: number
          remote_actor_id: number
          state: Database["public"]["Enums"]["ApFollowState"]
          user_id: number
        }
        Insert: {
          accepted_at?: string | null
          created_at?: string
          id?: number
          remote_actor_id: number
          state?: Database["public"]["Enums"]["ApFollowState"]
          user_id: number
        }
        Update: {
          accepted_at?: string | null
          created_at?: string
          id?: number
          remote_actor_id?: number
          state?: Database["public"]["Enums"]["ApFollowState"]
          user_id?: number
        }
        Relationships: [
          {
            foreignKeyName: "ap_following_remote_actor_id_fkey"
            columns: ["remote_actor_id"]
            isOneToOne: false
            referencedRelation: "ap_remote_actors"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "ap_following_user_id_fkey"
            columns: ["user_id"]
            isOneToOne: false
            referencedRelation: "users"
            referencedColumns: ["id"]
          },
        ]
      }
      ap_outbox: {
        Row: {
          activity_json: Json
          actor_user_id: number
          created_at: string
          id: number
        }
        Insert: {
          activity_json: Json
          actor_user_id: number
          created_at?: string
          id?: number
        }
        Update: {
          activity_json?: Json
          actor_user_id?: number
          created_at?: string
          id?: number
        }
        Relationships: [
          {
            foreignKeyName: "ap_outbox_actor_user_id_fkey"
            columns: ["actor_user_id"]
            isOneToOne: false
            referencedRelation: "users"
            referencedColumns: ["id"]
          },
        ]
      }
      ap_remote_actors: {
        Row: {
          blocked: boolean
          domain: string | null
          id: number
          inbox: string | null
          lastSeen: string | null
          preferredUsername: string | null
          publicKeyPem: string | null
          sharedInbox: string | null
          url: string
        }
        Insert: {
          blocked?: boolean
          domain?: string | null
          id?: number
          inbox?: string | null
          lastSeen?: string | null
          preferredUsername?: string | null
          publicKeyPem?: string | null
          sharedInbox?: string | null
          url: string
        }
        Update: {
          blocked?: boolean
          domain?: string | null
          id?: number
          inbox?: string | null
          lastSeen?: string | null
          preferredUsername?: string | null
          publicKeyPem?: string | null
          sharedInbox?: string | null
          url?: string
        }
        Relationships: []
      }
      archived_posts: {
        Row: {
          archived_at: string
          author_id: number
          content: string
          created_at: string
          expiration_date: string | null
          id: number
          like_count: number
          original_post_id: number
          parent_id: number | null
          updated_at: string | null
        }
        Insert: {
          archived_at?: string
          author_id: number
          content: string
          created_at: string
          expiration_date?: string | null
          id?: number
          like_count?: number
          original_post_id: number
          parent_id?: number | null
          updated_at?: string | null
        }
        Update: {
          archived_at?: string
          author_id?: number
          content?: string
          created_at?: string
          expiration_date?: string | null
          id?: number
          like_count?: number
          original_post_id?: number
          parent_id?: number | null
          updated_at?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "archived_posts_author_id_fkey"
            columns: ["author_id"]
            isOneToOne: false
            referencedRelation: "users"
            referencedColumns: ["id"]
          },
        ]
      }
      archived_realtime_posts: {
        Row: {
          archived_at: string
          author_id: number
          caption: string | null
          collageColumns: number | null
          collageGap: number | null
          collageLayoutStyle: string | null
          content: string | null
          created_at: string
          expiration_date: string | null
          id: number
          image_url: string | null
          isPublic: boolean
          like_count: number
          locked: boolean
          original_post_id: number
          parent_id: number | null
          pluginData: Json | null
          pluginType: string | null
          realtime_room_id: string
          type: Database["public"]["Enums"]["realtime_post_type"]
          updated_at: string | null
          video_url: string | null
          x_coordinate: number
          y_coordinate: number
        }
        Insert: {
          archived_at?: string
          author_id: number
          caption?: string | null
          collageColumns?: number | null
          collageGap?: number | null
          collageLayoutStyle?: string | null
          content?: string | null
          created_at: string
          expiration_date?: string | null
          id?: number
          image_url?: string | null
          isPublic?: boolean
          like_count?: number
          locked?: boolean
          original_post_id: number
          parent_id?: number | null
          pluginData?: Json | null
          pluginType?: string | null
          realtime_room_id: string
          type?: Database["public"]["Enums"]["realtime_post_type"]
          updated_at?: string | null
          video_url?: string | null
          x_coordinate: number
          y_coordinate: number
        }
        Update: {
          archived_at?: string
          author_id?: number
          caption?: string | null
          collageColumns?: number | null
          collageGap?: number | null
          collageLayoutStyle?: string | null
          content?: string | null
          created_at?: string
          expiration_date?: string | null
          id?: number
          image_url?: string | null
          isPublic?: boolean
          like_count?: number
          locked?: boolean
          original_post_id?: number
          parent_id?: number | null
          pluginData?: Json | null
          pluginType?: string | null
          realtime_room_id?: string
          type?: Database["public"]["Enums"]["realtime_post_type"]
          updated_at?: string | null
          video_url?: string | null
          x_coordinate?: number
          y_coordinate?: number
        }
        Relationships: [
          {
            foreignKeyName: "archived_realtime_posts_author_id_fkey"
            columns: ["author_id"]
            isOneToOne: false
            referencedRelation: "users"
            referencedColumns: ["id"]
          },
        ]
      }
      article_revisions: {
        Row: {
          articleId: string
          astJson: Json
          createdAt: string
          id: string
        }
        Insert: {
          articleId: string
          astJson: Json
          createdAt?: string
          id: string
        }
        Update: {
          articleId?: string
          astJson?: Json
          createdAt?: string
          id?: string
        }
        Relationships: [
          {
            foreignKeyName: "article_revisions_articleId_fkey"
            columns: ["articleId"]
            isOneToOne: false
            referencedRelation: "articles"
            referencedColumns: ["id"]
          },
        ]
      }
      articles: {
        Row: {
          allowAnnotations: boolean
          analytics: Json | null
          astJson: Json
          authorId: string
          createdAt: string
          deletedAt: string | null
          excerpt: string | null
          heroImageKey: string | null
          id: string
          publishedAt: string | null
          readingTime: number | null
          revisionId: string | null
          slug: string
          status: Database["public"]["Enums"]["ArticleStatus"]
          template: string
          title: string
          updatedAt: string
        }
        Insert: {
          allowAnnotations?: boolean
          analytics?: Json | null
          astJson: Json
          authorId: string
          createdAt?: string
          deletedAt?: string | null
          excerpt?: string | null
          heroImageKey?: string | null
          id: string
          publishedAt?: string | null
          readingTime?: number | null
          revisionId?: string | null
          slug: string
          status?: Database["public"]["Enums"]["ArticleStatus"]
          template?: string
          title: string
          updatedAt: string
        }
        Update: {
          allowAnnotations?: boolean
          analytics?: Json | null
          astJson?: Json
          authorId?: string
          createdAt?: string
          deletedAt?: string | null
          excerpt?: string | null
          heroImageKey?: string | null
          id?: string
          publishedAt?: string | null
          readingTime?: number | null
          revisionId?: string | null
          slug?: string
          status?: Database["public"]["Enums"]["ArticleStatus"]
          template?: string
          title?: string
          updatedAt?: string
        }
        Relationships: []
      }
      auctions: {
        Row: {
          created_at: string
          currency: string
          ends_at: string
          id: number
          item_id: number
          reserve: number
          stall_id: number
          state: Database["public"]["Enums"]["auction_state"]
          winner_id: number | null
        }
        Insert: {
          created_at?: string
          currency?: string
          ends_at: string
          id?: number
          item_id: number
          reserve: number
          stall_id: number
          state?: Database["public"]["Enums"]["auction_state"]
          winner_id?: number | null
        }
        Update: {
          created_at?: string
          currency?: string
          ends_at?: string
          id?: number
          item_id?: number
          reserve?: number
          stall_id?: number
          state?: Database["public"]["Enums"]["auction_state"]
          winner_id?: number | null
        }
        Relationships: [
          {
            foreignKeyName: "auctions_item_id_fkey"
            columns: ["item_id"]
            isOneToOne: false
            referencedRelation: "items"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "auctions_stall_id_fkey"
            columns: ["stall_id"]
            isOneToOne: false
            referencedRelation: "stalls"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "auctions_winner_id_fkey"
            columns: ["winner_id"]
            isOneToOne: false
            referencedRelation: "users"
            referencedColumns: ["id"]
          },
        ]
      }
      bids: {
        Row: {
          amount: number
          auction_id: number
          bidder_id: number
          created_at: string
          id: number
        }
        Insert: {
          amount: number
          auction_id: number
          bidder_id: number
          created_at?: string
          id?: number
        }
        Update: {
          amount?: number
          auction_id?: number
          bidder_id?: number
          created_at?: string
          id?: number
        }
        Relationships: [
          {
            foreignKeyName: "bids_auction_id_fkey"
            columns: ["auction_id"]
            isOneToOne: false
            referencedRelation: "auctions"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "bids_bidder_id_fkey"
            columns: ["bidder_id"]
            isOneToOne: false
            referencedRelation: "users"
            referencedColumns: ["id"]
          },
        ]
      }
      bookmarks: {
        Row: {
          created_at: string
          id: number
          label: string | null
          message_id: number
          user_id: number
        }
        Insert: {
          created_at?: string
          id?: number
          label?: string | null
          message_id: number
          user_id: number
        }
        Update: {
          created_at?: string
          id?: number
          label?: string | null
          message_id?: number
          user_id?: number
        }
        Relationships: [
          {
            foreignKeyName: "bookmarks_message_id_fkey"
            columns: ["message_id"]
            isOneToOne: false
            referencedRelation: "messages"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "bookmarks_user_id_fkey"
            columns: ["user_id"]
            isOneToOne: false
            referencedRelation: "users"
            referencedColumns: ["id"]
          },
        ]
      }
      canonical_media: {
        Row: {
          embedding: number[] | null
          id: string
          mediaType: string
          metadata: Json | null
          title: string
          updatedAt: string
        }
        Insert: {
          embedding?: number[] | null
          id: string
          mediaType: string
          metadata?: Json | null
          title: string
          updatedAt: string
        }
        Update: {
          embedding?: number[] | null
          id?: string
          mediaType?: string
          metadata?: Json | null
          title?: string
          updatedAt?: string
        }
        Relationships: []
      }
      cart: {
        Row: {
          created_at: string
          deadline: string
          id: number
          offer_id: number
          user_id: number
        }
        Insert: {
          created_at?: string
          deadline: string
          id?: number
          offer_id: number
          user_id: number
        }
        Update: {
          created_at?: string
          deadline?: string
          id?: number
          offer_id?: number
          user_id?: number
        }
        Relationships: [
          {
            foreignKeyName: "cart_offer_id_fkey"
            columns: ["offer_id"]
            isOneToOne: false
            referencedRelation: "offers"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "cart_user_id_fkey"
            columns: ["user_id"]
            isOneToOne: false
            referencedRelation: "users"
            referencedColumns: ["id"]
          },
        ]
      }
      cart_items: {
        Row: {
          created_at: string
          id: number
          item_id: number
          qty: number
          user_id: number
        }
        Insert: {
          created_at?: string
          id?: number
          item_id: number
          qty?: number
          user_id: number
        }
        Update: {
          created_at?: string
          id?: number
          item_id?: number
          qty?: number
          user_id?: number
        }
        Relationships: [
          {
            foreignKeyName: "cart_items_item_id_fkey"
            columns: ["item_id"]
            isOneToOne: false
            referencedRelation: "items"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "cart_items_user_id_fkey"
            columns: ["user_id"]
            isOneToOne: false
            referencedRelation: "users"
            referencedColumns: ["id"]
          },
        ]
      }
      Comment: {
        Row: {
          body: string
          createdAt: string
          createdBy: string
          downvotes: number
          id: string
          threadId: string
          upvotes: number
        }
        Insert: {
          body: string
          createdAt?: string
          createdBy: string
          downvotes?: number
          id: string
          threadId: string
          upvotes?: number
        }
        Update: {
          body?: string
          createdAt?: string
          createdBy?: string
          downvotes?: number
          id?: string
          threadId?: string
          upvotes?: number
        }
        Relationships: [
          {
            foreignKeyName: "Comment_threadId_fkey"
            columns: ["threadId"]
            isOneToOne: false
            referencedRelation: "CommentThread"
            referencedColumns: ["id"]
          },
        ]
      }
      CommentThread: {
        Row: {
          anchor: Json
          articleId: string
          createdAt: string
          createdBy: string
          id: string
          resolved: boolean
        }
        Insert: {
          anchor: Json
          articleId: string
          createdAt?: string
          createdBy: string
          id: string
          resolved?: boolean
        }
        Update: {
          anchor?: Json
          articleId?: string
          createdAt?: string
          createdBy?: string
          id?: string
          resolved?: boolean
        }
        Relationships: [
          {
            foreignKeyName: "CommentThread_articleId_fkey"
            columns: ["articleId"]
            isOneToOne: false
            referencedRelation: "articles"
            referencedColumns: ["id"]
          },
        ]
      }
      conversation_participants: {
        Row: {
          conversation_id: number
          id: number
          joined_at: string
          user_id: number
        }
        Insert: {
          conversation_id: number
          id?: number
          joined_at?: string
          user_id: number
        }
        Update: {
          conversation_id?: number
          id?: number
          joined_at?: string
          user_id?: number
        }
        Relationships: [
          {
            foreignKeyName: "conversation_participants_conversation_id_fkey"
            columns: ["conversation_id"]
            isOneToOne: false
            referencedRelation: "conversations"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "conversation_participants_user_id_fkey"
            columns: ["user_id"]
            isOneToOne: false
            referencedRelation: "users"
            referencedColumns: ["id"]
          },
        ]
      }
      conversation_state: {
        Row: {
          conversationId: number
          lastReadAt: string
          userId: number
        }
        Insert: {
          conversationId: number
          lastReadAt?: string
          userId: number
        }
        Update: {
          conversationId?: number
          lastReadAt?: string
          userId?: number
        }
        Relationships: []
      }
      conversations: {
        Row: {
          created_at: string
          id: number
          is_group: boolean
          title: string | null
          updated_at: string
          user1_id: number | null
          user2_id: number | null
        }
        Insert: {
          created_at?: string
          id?: number
          is_group?: boolean
          title?: string | null
          updated_at?: string
          user1_id?: number | null
          user2_id?: number | null
        }
        Update: {
          created_at?: string
          id?: number
          is_group?: boolean
          title?: string | null
          updated_at?: string
          user1_id?: number | null
          user2_id?: number | null
        }
        Relationships: [
          {
            foreignKeyName: "conversations_user1_id_fkey"
            columns: ["user1_id"]
            isOneToOne: false
            referencedRelation: "users"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "conversations_user2_id_fkey"
            columns: ["user2_id"]
            isOneToOne: false
            referencedRelation: "users"
            referencedColumns: ["id"]
          },
        ]
      }
      drift_members: {
        Row: {
          collapsed: boolean
          drift_id: number
          id: number
          joined_at: string
          last_read_at: string | null
          muted: boolean
          pinned: boolean
          user_id: number
        }
        Insert: {
          collapsed?: boolean
          drift_id: number
          id?: number
          joined_at?: string
          last_read_at?: string | null
          muted?: boolean
          pinned?: boolean
          user_id: number
        }
        Update: {
          collapsed?: boolean
          drift_id?: number
          id?: number
          joined_at?: string
          last_read_at?: string | null
          muted?: boolean
          pinned?: boolean
          user_id?: number
        }
        Relationships: [
          {
            foreignKeyName: "drift_members_drift_id_fkey"
            columns: ["drift_id"]
            isOneToOne: false
            referencedRelation: "drifts"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "drift_members_user_id_fkey"
            columns: ["user_id"]
            isOneToOne: false
            referencedRelation: "users"
            referencedColumns: ["id"]
          },
        ]
      }
      drifts: {
        Row: {
          anchor_message_id: number | null
          conversation_id: number
          created_at: string
          created_by: number
          id: number
          is_archived: boolean
          is_closed: boolean
          kind: Database["public"]["Enums"]["DriftKind"]
          last_message_at: string | null
          message_count: number
          root_message_id: number | null
          title: string
          updated_at: string
        }
        Insert: {
          anchor_message_id?: number | null
          conversation_id: number
          created_at?: string
          created_by: number
          id?: number
          is_archived?: boolean
          is_closed?: boolean
          kind?: Database["public"]["Enums"]["DriftKind"]
          last_message_at?: string | null
          message_count?: number
          root_message_id?: number | null
          title: string
          updated_at: string
        }
        Update: {
          anchor_message_id?: number | null
          conversation_id?: number
          created_at?: string
          created_by?: number
          id?: number
          is_archived?: boolean
          is_closed?: boolean
          kind?: Database["public"]["Enums"]["DriftKind"]
          last_message_at?: string | null
          message_count?: number
          root_message_id?: number | null
          title?: string
          updated_at?: string
        }
        Relationships: [
          {
            foreignKeyName: "drifts_anchor_message_id_fkey"
            columns: ["anchor_message_id"]
            isOneToOne: false
            referencedRelation: "messages"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "drifts_conversation_id_fkey"
            columns: ["conversation_id"]
            isOneToOne: false
            referencedRelation: "conversations"
            referencedColumns: ["id"]
          },
        ]
      }
      escrow: {
        Row: {
          cart_id: number
          created_at: string
          id: number
          state: Database["public"]["Enums"]["escrow_state"]
          tx_ref: string | null
          updated_at: string
        }
        Insert: {
          cart_id: number
          created_at?: string
          id?: number
          state?: Database["public"]["Enums"]["escrow_state"]
          tx_ref?: string | null
          updated_at?: string
        }
        Update: {
          cart_id?: number
          created_at?: string
          id?: number
          state?: Database["public"]["Enums"]["escrow_state"]
          tx_ref?: string | null
          updated_at?: string
        }
        Relationships: [
          {
            foreignKeyName: "escrow_cart_id_fkey"
            columns: ["cart_id"]
            isOneToOne: false
            referencedRelation: "cart"
            referencedColumns: ["id"]
          },
        ]
      }
      favorite_items: {
        Row: {
          addedAt: string
          mediaId: string
          rating: number | null
          userId: number
        }
        Insert: {
          addedAt?: string
          mediaId: string
          rating?: number | null
          userId: number
        }
        Update: {
          addedAt?: string
          mediaId?: string
          rating?: number | null
          userId?: number
        }
        Relationships: [
          {
            foreignKeyName: "favorite_items_mediaId_fkey"
            columns: ["mediaId"]
            isOneToOne: false
            referencedRelation: "canonical_media"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "favorite_items_userId_fkey"
            columns: ["userId"]
            isOneToOne: false
            referencedRelation: "users"
            referencedColumns: ["id"]
          },
        ]
      }
      feed_posts: {
        Row: {
          articleId: string | null
          author_id: number
          caption: string | null
          content: string | null
          created_at: string
          expiration_date: string | null
          id: number
          image_url: string | null
          isPublic: boolean
          library_post_id: string | null
          like_count: number
          parent_id: number | null
          pluginData: Json | null
          pluginType: string | null
          portfolio: Json | null
          stack_id: string | null
          thumbnailKey: string | null
          tldr: string | null
          type: Database["public"]["Enums"]["feed_post_type"]
          updated_at: string | null
          video_url: string | null
        }
        Insert: {
          articleId?: string | null
          author_id: number
          caption?: string | null
          content?: string | null
          created_at?: string
          expiration_date?: string | null
          id?: number
          image_url?: string | null
          isPublic?: boolean
          library_post_id?: string | null
          like_count?: number
          parent_id?: number | null
          pluginData?: Json | null
          pluginType?: string | null
          portfolio?: Json | null
          stack_id?: string | null
          thumbnailKey?: string | null
          tldr?: string | null
          type: Database["public"]["Enums"]["feed_post_type"]
          updated_at?: string | null
          video_url?: string | null
        }
        Update: {
          articleId?: string | null
          author_id?: number
          caption?: string | null
          content?: string | null
          created_at?: string
          expiration_date?: string | null
          id?: number
          image_url?: string | null
          isPublic?: boolean
          library_post_id?: string | null
          like_count?: number
          parent_id?: number | null
          pluginData?: Json | null
          pluginType?: string | null
          portfolio?: Json | null
          stack_id?: string | null
          thumbnailKey?: string | null
          tldr?: string | null
          type?: Database["public"]["Enums"]["feed_post_type"]
          updated_at?: string | null
          video_url?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "feed_posts_author_id_fkey"
            columns: ["author_id"]
            isOneToOne: false
            referencedRelation: "users"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "feed_posts_library_post_id_fkey"
            columns: ["library_post_id"]
            isOneToOne: false
            referencedRelation: "library_posts"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "feed_posts_parent_id_fkey"
            columns: ["parent_id"]
            isOneToOne: false
            referencedRelation: "feed_posts"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "feed_posts_stack_id_fkey"
            columns: ["stack_id"]
            isOneToOne: false
            referencedRelation: "stacks"
            referencedColumns: ["id"]
          },
        ]
      }
      follows: {
        Row: {
          created_at: string
          follower_id: number
          following_id: number
          id: number
        }
        Insert: {
          created_at?: string
          follower_id: number
          following_id: number
          id?: number
        }
        Update: {
          created_at?: string
          follower_id?: number
          following_id?: number
          id?: number
        }
        Relationships: [
          {
            foreignKeyName: "follows_follower_id_fkey"
            columns: ["follower_id"]
            isOneToOne: false
            referencedRelation: "users"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "follows_following_id_fkey"
            columns: ["following_id"]
            isOneToOne: false
            referencedRelation: "users"
            referencedColumns: ["id"]
          },
        ]
      }
      friend_suggestions: {
        Row: {
          created_at: string
          id: number
          score: number
          suggested_user_id: number
          user_id: number
        }
        Insert: {
          created_at?: string
          id?: number
          score: number
          suggested_user_id: number
          user_id: number
        }
        Update: {
          created_at?: string
          id?: number
          score?: number
          suggested_user_id?: number
          user_id?: number
        }
        Relationships: [
          {
            foreignKeyName: "friend_suggestions_suggested_user_id_fkey"
            columns: ["suggested_user_id"]
            isOneToOne: false
            referencedRelation: "users"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "friend_suggestions_user_id_fkey"
            columns: ["user_id"]
            isOneToOne: false
            referencedRelation: "users"
            referencedColumns: ["id"]
          },
        ]
      }
      group_meetings: {
        Row: {
          createdAt: string
          id: string
          origins: Json | null
          participantUids: string[] | null
          status: string
          title: string | null
          votes: Json | null
        }
        Insert: {
          createdAt?: string
          id: string
          origins?: Json | null
          participantUids?: string[] | null
          status?: string
          title?: string | null
          votes?: Json | null
        }
        Update: {
          createdAt?: string
          id?: string
          origins?: Json | null
          participantUids?: string[] | null
          status?: string
          title?: string | null
          votes?: Json | null
        }
        Relationships: []
      }
      integrations: {
        Row: {
          access_token_cipher: string | null
          created_at: string
          credential: string
          expires_at: string | null
          external_account_id: string | null
          id: number
          metadata: Json | null
          refresh_token_cipher: string | null
          scopes: string[] | null
          service: string
          status: Database["public"]["Enums"]["IntegrationStatus"]
          updated_at: string
          user_id: number
        }
        Insert: {
          access_token_cipher?: string | null
          created_at?: string
          credential: string
          expires_at?: string | null
          external_account_id?: string | null
          id?: number
          metadata?: Json | null
          refresh_token_cipher?: string | null
          scopes?: string[] | null
          service: string
          status?: Database["public"]["Enums"]["IntegrationStatus"]
          updated_at?: string
          user_id: number
        }
        Update: {
          access_token_cipher?: string | null
          created_at?: string
          credential?: string
          expires_at?: string | null
          external_account_id?: string | null
          id?: number
          metadata?: Json | null
          refresh_token_cipher?: string | null
          scopes?: string[] | null
          service?: string
          status?: Database["public"]["Enums"]["IntegrationStatus"]
          updated_at?: string
          user_id?: number
        }
        Relationships: [
          {
            foreignKeyName: "integrations_user_id_fkey"
            columns: ["user_id"]
            isOneToOne: false
            referencedRelation: "users"
            referencedColumns: ["id"]
          },
        ]
      }
      items: {
        Row: {
          created_at: string
          currency: string
          description: string
          id: number
          images: string[] | null
          name: string
          price: number | null
          stall_id: number
          stock: number
        }
        Insert: {
          created_at?: string
          currency?: string
          description: string
          id?: number
          images?: string[] | null
          name: string
          price?: number | null
          stall_id: number
          stock: number
        }
        Update: {
          created_at?: string
          currency?: string
          description?: string
          id?: number
          images?: string[] | null
          name?: string
          price?: number | null
          stall_id?: number
          stock?: number
        }
        Relationships: [
          {
            foreignKeyName: "items_stall_id_fkey"
            columns: ["stall_id"]
            isOneToOne: false
            referencedRelation: "stalls"
            referencedColumns: ["id"]
          },
        ]
      }
      library_posts: {
        Row: {
          created_at: string
          file_url: string
          id: string
          page_count: number
          stack_id: string | null
          thumb_urls: string[] | null
          title: string | null
          uploader_id: number
        }
        Insert: {
          created_at?: string
          file_url: string
          id: string
          page_count: number
          stack_id?: string | null
          thumb_urls?: string[] | null
          title?: string | null
          uploader_id: number
        }
        Update: {
          created_at?: string
          file_url?: string
          id?: string
          page_count?: number
          stack_id?: string | null
          thumb_urls?: string[] | null
          title?: string | null
          uploader_id?: number
        }
        Relationships: [
          {
            foreignKeyName: "library_posts_stack_id_fkey"
            columns: ["stack_id"]
            isOneToOne: false
            referencedRelation: "stacks"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "library_posts_uploader_id_fkey"
            columns: ["uploader_id"]
            isOneToOne: false
            referencedRelation: "users"
            referencedColumns: ["id"]
          },
        ]
      }
      likes: {
        Row: {
          created_at: string
          feed_post_id: number
          id: number
          score: number
          type: Database["public"]["Enums"]["like_type"]
          updated_at: string | null
          user_id: number
        }
        Insert: {
          created_at?: string
          feed_post_id: number
          id?: number
          score: number
          type?: Database["public"]["Enums"]["like_type"]
          updated_at?: string | null
          user_id: number
        }
        Update: {
          created_at?: string
          feed_post_id?: number
          id?: number
          score?: number
          type?: Database["public"]["Enums"]["like_type"]
          updated_at?: string | null
          user_id?: number
        }
        Relationships: [
          {
            foreignKeyName: "likes_feed_post_id_fkey"
            columns: ["feed_post_id"]
            isOneToOne: false
            referencedRelation: "feed_posts"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "likes_user_id_fkey"
            columns: ["user_id"]
            isOneToOne: false
            referencedRelation: "users"
            referencedColumns: ["id"]
          },
        ]
      }
      link_previews: {
        Row: {
          desc: string | null
          facetId: number | null
          fetchedAt: string
          image: string | null
          status: string
          title: string | null
          url: string
          urlHash: string
        }
        Insert: {
          desc?: string | null
          facetId?: number | null
          fetchedAt?: string
          image?: string | null
          status: string
          title?: string | null
          url: string
          urlHash: string
        }
        Update: {
          desc?: string | null
          facetId?: number | null
          fetchedAt?: string
          image?: string | null
          status?: string
          title?: string | null
          url?: string
          urlHash?: string
        }
        Relationships: [
          {
            foreignKeyName: "link_previews_facetId_fkey"
            columns: ["facetId"]
            isOneToOne: false
            referencedRelation: "sheaf_facets"
            referencedColumns: ["id"]
          },
        ]
      }
      linked_accounts: {
        Row: {
          access_token: string
          created_at: string
          expires_at: string | null
          id: number
          provider: string
          refresh_token: string
          user_id: number
        }
        Insert: {
          access_token: string
          created_at?: string
          expires_at?: string | null
          id?: number
          provider: string
          refresh_token: string
          user_id: number
        }
        Update: {
          access_token?: string
          created_at?: string
          expires_at?: string | null
          id?: number
          provider?: string
          refresh_token?: string
          user_id?: number
        }
        Relationships: [
          {
            foreignKeyName: "linked_accounts_user_id_fkey"
            columns: ["user_id"]
            isOneToOne: false
            referencedRelation: "users"
            referencedColumns: ["id"]
          },
        ]
      }
      message_attachments: {
        Row: {
          created_at: string
          id: number
          message_id: number
          metadata: Json | null
          path: string
          size: number
          type: string
        }
        Insert: {
          created_at?: string
          id?: number
          message_id: number
          metadata?: Json | null
          path: string
          size: number
          type: string
        }
        Update: {
          created_at?: string
          id?: number
          message_id?: number
          metadata?: Json | null
          path?: string
          size?: number
          type?: string
        }
        Relationships: [
          {
            foreignKeyName: "message_attachments_message_id_fkey"
            columns: ["message_id"]
            isOneToOne: false
            referencedRelation: "messages"
            referencedColumns: ["id"]
          },
        ]
      }
      message_mentions: {
        Row: {
          createdAt: string
          facetId: number | null
          id: number
          messageId: number
          userId: number
        }
        Insert: {
          createdAt?: string
          facetId?: number | null
          id?: number
          messageId: number
          userId: number
        }
        Update: {
          createdAt?: string
          facetId?: number | null
          id?: number
          messageId?: number
          userId?: number
        }
        Relationships: [
          {
            foreignKeyName: "message_mentions_facetId_fkey"
            columns: ["facetId"]
            isOneToOne: false
            referencedRelation: "sheaf_facets"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "message_mentions_messageId_fkey"
            columns: ["messageId"]
            isOneToOne: false
            referencedRelation: "messages"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "message_mentions_userId_fkey"
            columns: ["userId"]
            isOneToOne: false
            referencedRelation: "users"
            referencedColumns: ["id"]
          },
        ]
      }
      message_stars: {
        Row: {
          created_at: string
          message_id: number
          user_id: number
        }
        Insert: {
          created_at?: string
          message_id: number
          user_id: number
        }
        Update: {
          created_at?: string
          message_id?: number
          user_id?: number
        }
        Relationships: [
          {
            foreignKeyName: "message_stars_message_id_fkey"
            columns: ["message_id"]
            isOneToOne: false
            referencedRelation: "messages"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "message_stars_user_id_fkey"
            columns: ["user_id"]
            isOneToOne: false
            referencedRelation: "users"
            referencedColumns: ["id"]
          },
        ]
      }
      MessageReaction: {
        Row: {
          createdAt: string
          emoji: string
          facetId: number | null
          id: number
          messageId: number
          userId: number
        }
        Insert: {
          createdAt?: string
          emoji: string
          facetId?: number | null
          id?: number
          messageId: number
          userId: number
        }
        Update: {
          createdAt?: string
          emoji?: string
          facetId?: number | null
          id?: number
          messageId?: number
          userId?: number
        }
        Relationships: [
          {
            foreignKeyName: "MessageReaction_facetId_fkey"
            columns: ["facetId"]
            isOneToOne: false
            referencedRelation: "sheaf_facets"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "MessageReaction_messageId_fkey"
            columns: ["messageId"]
            isOneToOne: false
            referencedRelation: "messages"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "MessageReaction_userId_fkey"
            columns: ["userId"]
            isOneToOne: false
            referencedRelation: "users"
            referencedColumns: ["id"]
          },
        ]
      }
      messages: {
        Row: {
          client_id: string | null
          conversation_id: number
          created_at: string
          deleted_at: string | null
          drift_id: number | null
          edited_at: string | null
          id: number
          is_redacted: boolean
          last_reply_at: string | null
          meta: Json | null
          reply_count: number
          reply_to: number | null
          sender_id: number
          text: string | null
        }
        Insert: {
          client_id?: string | null
          conversation_id: number
          created_at?: string
          deleted_at?: string | null
          drift_id?: number | null
          edited_at?: string | null
          id?: number
          is_redacted?: boolean
          last_reply_at?: string | null
          meta?: Json | null
          reply_count?: number
          reply_to?: number | null
          sender_id: number
          text?: string | null
        }
        Update: {
          client_id?: string | null
          conversation_id?: number
          created_at?: string
          deleted_at?: string | null
          drift_id?: number | null
          edited_at?: string | null
          id?: number
          is_redacted?: boolean
          last_reply_at?: string | null
          meta?: Json | null
          reply_count?: number
          reply_to?: number | null
          sender_id?: number
          text?: string | null
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
            foreignKeyName: "messages_drift_id_fkey"
            columns: ["drift_id"]
            isOneToOne: false
            referencedRelation: "drifts"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "messages_sender_id_fkey"
            columns: ["sender_id"]
            isOneToOne: false
            referencedRelation: "users"
            referencedColumns: ["id"]
          },
        ]
      }
      notifications: {
        Row: {
          actor_id: number
          conversation_id: number | null
          created_at: string
          id: number
          market_id: string | null
          message_id: number | null
          read: boolean
          trade_id: string | null
          type: Database["public"]["Enums"]["notification_type"]
          user_id: number
        }
        Insert: {
          actor_id: number
          conversation_id?: number | null
          created_at?: string
          id?: number
          market_id?: string | null
          message_id?: number | null
          read?: boolean
          trade_id?: string | null
          type: Database["public"]["Enums"]["notification_type"]
          user_id: number
        }
        Update: {
          actor_id?: number
          conversation_id?: number | null
          created_at?: string
          id?: number
          market_id?: string | null
          message_id?: number | null
          read?: boolean
          trade_id?: string | null
          type?: Database["public"]["Enums"]["notification_type"]
          user_id?: number
        }
        Relationships: [
          {
            foreignKeyName: "notifications_actor_id_fkey"
            columns: ["actor_id"]
            isOneToOne: false
            referencedRelation: "users"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "notifications_conversation_id_fkey"
            columns: ["conversation_id"]
            isOneToOne: false
            referencedRelation: "conversations"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "notifications_market_id_fkey"
            columns: ["market_id"]
            isOneToOne: false
            referencedRelation: "prediction_markets"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "notifications_message_id_fkey"
            columns: ["message_id"]
            isOneToOne: false
            referencedRelation: "messages"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "notifications_trade_id_fkey"
            columns: ["trade_id"]
            isOneToOne: false
            referencedRelation: "prediction_trades"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "notifications_user_id_fkey"
            columns: ["user_id"]
            isOneToOne: false
            referencedRelation: "users"
            referencedColumns: ["id"]
          },
        ]
      }
      offer_events: {
        Row: {
          created_at: string
          id: number
          kind: Database["public"]["Enums"]["OfferEventKind"]
          offer_id: number
          payload: Json | null
        }
        Insert: {
          created_at?: string
          id?: number
          kind: Database["public"]["Enums"]["OfferEventKind"]
          offer_id: number
          payload?: Json | null
        }
        Update: {
          created_at?: string
          id?: number
          kind?: Database["public"]["Enums"]["OfferEventKind"]
          offer_id?: number
          payload?: Json | null
        }
        Relationships: [
          {
            foreignKeyName: "offer_events_offer_id_fkey"
            columns: ["offer_id"]
            isOneToOne: false
            referencedRelation: "offers"
            referencedColumns: ["id"]
          },
        ]
      }
      offers: {
        Row: {
          amount: number
          buyer_id: number
          counter_of_id: number | null
          created_at: string
          currency: string
          expires_at: string | null
          id: number
          item_id: number | null
          message: string | null
          seller_id: number
          stall_id: number
          status: Database["public"]["Enums"]["OfferStatus"]
          updated_at: string
          version: number
        }
        Insert: {
          amount: number
          buyer_id: number
          counter_of_id?: number | null
          created_at?: string
          currency?: string
          expires_at?: string | null
          id?: number
          item_id?: number | null
          message?: string | null
          seller_id: number
          stall_id: number
          status?: Database["public"]["Enums"]["OfferStatus"]
          updated_at?: string
          version?: number
        }
        Update: {
          amount?: number
          buyer_id?: number
          counter_of_id?: number | null
          created_at?: string
          currency?: string
          expires_at?: string | null
          id?: number
          item_id?: number | null
          message?: string | null
          seller_id?: number
          stall_id?: number
          status?: Database["public"]["Enums"]["OfferStatus"]
          updated_at?: string
          version?: number
        }
        Relationships: [
          {
            foreignKeyName: "offers_buyer_id_fkey"
            columns: ["buyer_id"]
            isOneToOne: false
            referencedRelation: "users"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "offers_counter_of_id_fkey"
            columns: ["counter_of_id"]
            isOneToOne: false
            referencedRelation: "offers"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "offers_item_id_fkey"
            columns: ["item_id"]
            isOneToOne: false
            referencedRelation: "items"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "offers_seller_id_fkey"
            columns: ["seller_id"]
            isOneToOne: false
            referencedRelation: "Seller"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "offers_stall_id_fkey"
            columns: ["stall_id"]
            isOneToOne: false
            referencedRelation: "stalls"
            referencedColumns: ["id"]
          },
        ]
      }
      order_items: {
        Row: {
          created_at: string
          id: number
          item_id: number
          order_id: number
          qty: number
          unit_price: number | null
        }
        Insert: {
          created_at?: string
          id?: number
          item_id: number
          order_id: number
          qty: number
          unit_price?: number | null
        }
        Update: {
          created_at?: string
          id?: number
          item_id?: number
          order_id?: number
          qty?: number
          unit_price?: number | null
        }
        Relationships: [
          {
            foreignKeyName: "order_items_item_id_fkey"
            columns: ["item_id"]
            isOneToOne: false
            referencedRelation: "items"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "order_items_order_id_fkey"
            columns: ["order_id"]
            isOneToOne: false
            referencedRelation: "orders"
            referencedColumns: ["id"]
          },
        ]
      }
      order_lines: {
        Row: {
          created_at: string
          id: number
          item_id: number | null
          order_id: number | null
          price_cents: number | null
          quantity: number | null
        }
        Insert: {
          created_at?: string
          id?: number
          item_id?: number | null
          order_id?: number | null
          price_cents?: number | null
          quantity?: number | null
        }
        Update: {
          created_at?: string
          id?: number
          item_id?: number | null
          order_id?: number | null
          price_cents?: number | null
          quantity?: number | null
        }
        Relationships: [
          {
            foreignKeyName: "order_lines_item_id_fkey"
            columns: ["item_id"]
            isOneToOne: false
            referencedRelation: "items"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "order_lines_order_id_fkey"
            columns: ["order_id"]
            isOneToOne: false
            referencedRelation: "orders"
            referencedColumns: ["id"]
          },
        ]
      }
      orders: {
        Row: {
          auction_id: number | null
          buyer_id: number | null
          created_at: string
          currency: string
          fulfilled_at: string | null
          hold_days: number
          id: number
          pmId: string | null
          released_at: string | null
          shipping: number | null
          stall_id: number
          status: Database["public"]["Enums"]["OrderStatus"]
          stripePI: string | null
          subtotal: number | null
          total: number | null
          updated_at: string
        }
        Insert: {
          auction_id?: number | null
          buyer_id?: number | null
          created_at?: string
          currency?: string
          fulfilled_at?: string | null
          hold_days?: number
          id?: number
          pmId?: string | null
          released_at?: string | null
          shipping?: number | null
          stall_id: number
          status?: Database["public"]["Enums"]["OrderStatus"]
          stripePI?: string | null
          subtotal?: number | null
          total?: number | null
          updated_at?: string
        }
        Update: {
          auction_id?: number | null
          buyer_id?: number | null
          created_at?: string
          currency?: string
          fulfilled_at?: string | null
          hold_days?: number
          id?: number
          pmId?: string | null
          released_at?: string | null
          shipping?: number | null
          stall_id?: number
          status?: Database["public"]["Enums"]["OrderStatus"]
          stripePI?: string | null
          subtotal?: number | null
          total?: number | null
          updated_at?: string
        }
        Relationships: [
          {
            foreignKeyName: "orders_auction_id_fkey"
            columns: ["auction_id"]
            isOneToOne: false
            referencedRelation: "auctions"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "orders_buyer_id_fkey"
            columns: ["buyer_id"]
            isOneToOne: false
            referencedRelation: "users"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "orders_stall_id_fkey"
            columns: ["stall_id"]
            isOneToOne: false
            referencedRelation: "stalls"
            referencedColumns: ["id"]
          },
        ]
      }
      party_presence: {
        Row: {
          id: string
          party_id: string
          updated_at: string
          user_id: number
          x: number
          y: number
        }
        Insert: {
          id: string
          party_id: string
          updated_at?: string
          user_id: number
          x: number
          y: number
        }
        Update: {
          id?: string
          party_id?: string
          updated_at?: string
          user_id?: number
          x?: number
          y?: number
        }
        Relationships: []
      }
      poll_votes: {
        Row: {
          created_at: string
          id: number
          option_idx: number | null
          poll_id: number
          user_id: number
          value: number | null
        }
        Insert: {
          created_at?: string
          id?: number
          option_idx?: number | null
          poll_id: number
          user_id: number
          value?: number | null
        }
        Update: {
          created_at?: string
          id?: number
          option_idx?: number | null
          poll_id?: number
          user_id?: number
          value?: number | null
        }
        Relationships: [
          {
            foreignKeyName: "poll_votes_poll_id_fkey"
            columns: ["poll_id"]
            isOneToOne: false
            referencedRelation: "polls"
            referencedColumns: ["id"]
          },
        ]
      }
      polls: {
        Row: {
          anonymous: boolean
          closes_at: string | null
          conversation_id: number
          created_at: string
          created_by_id: number
          id: number
          kind: Database["public"]["Enums"]["PollKind"]
          max_options: number
          message_id: number
          options: string[] | null
        }
        Insert: {
          anonymous?: boolean
          closes_at?: string | null
          conversation_id: number
          created_at?: string
          created_by_id: number
          id?: number
          kind: Database["public"]["Enums"]["PollKind"]
          max_options?: number
          message_id: number
          options?: string[] | null
        }
        Update: {
          anonymous?: boolean
          closes_at?: string | null
          conversation_id?: number
          created_at?: string
          created_by_id?: number
          id?: number
          kind?: Database["public"]["Enums"]["PollKind"]
          max_options?: number
          message_id?: number
          options?: string[] | null
        }
        Relationships: []
      }
      portfolio_pages: {
        Row: {
          created_at: string
          css: string
          html: string
          id: number
          payload: Json | null
          slug: string
          snapshot: string | null
          tsx: string | null
        }
        Insert: {
          created_at?: string
          css: string
          html: string
          id?: number
          payload?: Json | null
          slug: string
          snapshot?: string | null
          tsx?: string | null
        }
        Update: {
          created_at?: string
          css?: string
          html?: string
          id?: number
          payload?: Json | null
          slug?: string
          snapshot?: string | null
          tsx?: string | null
        }
        Relationships: []
      }
      prediction_markets: {
        Row: {
          b: number
          closedAt: string | null
          closesAt: string
          creatorId: number
          id: string
          noPool: number
          oracleId: number | null
          outcome: Database["public"]["Enums"]["MarketOutcome"] | null
          postId: number
          question: string
          resolvesAt: string | null
          state: Database["public"]["Enums"]["PredictionState"]
          yesPool: number
        }
        Insert: {
          b?: number
          closedAt?: string | null
          closesAt: string
          creatorId: number
          id: string
          noPool?: number
          oracleId?: number | null
          outcome?: Database["public"]["Enums"]["MarketOutcome"] | null
          postId: number
          question: string
          resolvesAt?: string | null
          state?: Database["public"]["Enums"]["PredictionState"]
          yesPool?: number
        }
        Update: {
          b?: number
          closedAt?: string | null
          closesAt?: string
          creatorId?: number
          id?: string
          noPool?: number
          oracleId?: number | null
          outcome?: Database["public"]["Enums"]["MarketOutcome"] | null
          postId?: number
          question?: string
          resolvesAt?: string | null
          state?: Database["public"]["Enums"]["PredictionState"]
          yesPool?: number
        }
        Relationships: [
          {
            foreignKeyName: "prediction_markets_creatorId_fkey"
            columns: ["creatorId"]
            isOneToOne: false
            referencedRelation: "users"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "prediction_markets_oracleId_fkey"
            columns: ["oracleId"]
            isOneToOne: false
            referencedRelation: "users"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "prediction_markets_postId_fkey"
            columns: ["postId"]
            isOneToOne: false
            referencedRelation: "feed_posts"
            referencedColumns: ["id"]
          },
        ]
      }
      prediction_trades: {
        Row: {
          cost: number
          createdAt: string
          id: string
          marketId: string
          price: number
          shares: number
          side: Database["public"]["Enums"]["MarketOutcome"]
          userId: number
        }
        Insert: {
          cost: number
          createdAt?: string
          id: string
          marketId: string
          price: number
          shares: number
          side: Database["public"]["Enums"]["MarketOutcome"]
          userId: number
        }
        Update: {
          cost?: number
          createdAt?: string
          id?: string
          marketId?: string
          price?: number
          shares?: number
          side?: Database["public"]["Enums"]["MarketOutcome"]
          userId?: number
        }
        Relationships: [
          {
            foreignKeyName: "prediction_trades_marketId_fkey"
            columns: ["marketId"]
            isOneToOne: false
            referencedRelation: "prediction_markets"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "prediction_trades_userId_fkey"
            columns: ["userId"]
            isOneToOne: false
            referencedRelation: "users"
            referencedColumns: ["id"]
          },
        ]
      }
      product_review_claims: {
        Row: {
          created_at: string
          helpful_count: number
          id: number
          review_id: number
          text: string
          unhelpful_count: number
          vouch_total: number
        }
        Insert: {
          created_at?: string
          helpful_count?: number
          id?: number
          review_id: number
          text: string
          unhelpful_count?: number
          vouch_total?: number
        }
        Update: {
          created_at?: string
          helpful_count?: number
          id?: number
          review_id?: number
          text?: string
          unhelpful_count?: number
          vouch_total?: number
        }
        Relationships: [
          {
            foreignKeyName: "product_review_claims_review_id_fkey"
            columns: ["review_id"]
            isOneToOne: false
            referencedRelation: "product_reviews"
            referencedColumns: ["id"]
          },
        ]
      }
      product_review_votes: {
        Row: {
          claim_id: number
          created_at: string
          id: number
          type: string
          user_id: number
        }
        Insert: {
          claim_id: number
          created_at?: string
          id?: number
          type: string
          user_id: number
        }
        Update: {
          claim_id?: number
          created_at?: string
          id?: number
          type?: string
          user_id?: number
        }
        Relationships: [
          {
            foreignKeyName: "product_review_votes_claim_id_fkey"
            columns: ["claim_id"]
            isOneToOne: false
            referencedRelation: "product_review_claims"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "product_review_votes_user_id_fkey"
            columns: ["user_id"]
            isOneToOne: false
            referencedRelation: "users"
            referencedColumns: ["id"]
          },
        ]
      }
      product_review_vouches: {
        Row: {
          amount: number
          claim_id: number
          created_at: string
          id: number
          user_id: number
        }
        Insert: {
          amount: number
          claim_id: number
          created_at?: string
          id?: number
          user_id: number
        }
        Update: {
          amount?: number
          claim_id?: number
          created_at?: string
          id?: number
          user_id?: number
        }
        Relationships: [
          {
            foreignKeyName: "product_review_vouches_claim_id_fkey"
            columns: ["claim_id"]
            isOneToOne: false
            referencedRelation: "product_review_claims"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "product_review_vouches_user_id_fkey"
            columns: ["user_id"]
            isOneToOne: false
            referencedRelation: "users"
            referencedColumns: ["id"]
          },
        ]
      }
      product_reviews: {
        Row: {
          author_id: number
          created_at: string
          feed_post_id: number | null
          id: number
          image_urls: string[] | null
          product_link: string | null
          product_name: string
          rating: number
          realtime_post_id: number | null
          summary: string | null
          updated_at: string
        }
        Insert: {
          author_id: number
          created_at?: string
          feed_post_id?: number | null
          id?: number
          image_urls?: string[] | null
          product_link?: string | null
          product_name: string
          rating: number
          realtime_post_id?: number | null
          summary?: string | null
          updated_at?: string
        }
        Update: {
          author_id?: number
          created_at?: string
          feed_post_id?: number | null
          id?: number
          image_urls?: string[] | null
          product_link?: string | null
          product_name?: string
          rating?: number
          realtime_post_id?: number | null
          summary?: string | null
          updated_at?: string
        }
        Relationships: [
          {
            foreignKeyName: "product_reviews_author_id_fkey"
            columns: ["author_id"]
            isOneToOne: false
            referencedRelation: "users"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "product_reviews_feed_post_id_fkey"
            columns: ["feed_post_id"]
            isOneToOne: false
            referencedRelation: "feed_posts"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "product_reviews_realtime_post_id_fkey"
            columns: ["realtime_post_id"]
            isOneToOne: false
            referencedRelation: "realtime_posts"
            referencedColumns: ["id"]
          },
        ]
      }
      realtime_edges: {
        Row: {
          author_id: number
          created_at: string
          id: number
          realtime_room_id: string
          source_node_id: number
          target_node_id: number
          updated_at: string | null
        }
        Insert: {
          author_id: number
          created_at?: string
          id?: number
          realtime_room_id: string
          source_node_id: number
          target_node_id: number
          updated_at?: string | null
        }
        Update: {
          author_id?: number
          created_at?: string
          id?: number
          realtime_room_id?: string
          source_node_id?: number
          target_node_id?: number
          updated_at?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "realtime_edges_author_id_fkey"
            columns: ["author_id"]
            isOneToOne: false
            referencedRelation: "users"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "realtime_edges_realtime_room_id_fkey"
            columns: ["realtime_room_id"]
            isOneToOne: false
            referencedRelation: "realtime_rooms"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "realtime_edges_source_node_id_fkey"
            columns: ["source_node_id"]
            isOneToOne: false
            referencedRelation: "realtime_posts"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "realtime_edges_target_node_id_fkey"
            columns: ["target_node_id"]
            isOneToOne: false
            referencedRelation: "realtime_posts"
            referencedColumns: ["id"]
          },
        ]
      }
      realtime_likes: {
        Row: {
          created_at: string
          id: number
          realtime_post_id: number
          score: number
          type: Database["public"]["Enums"]["like_type"]
          updated_at: string | null
          user_id: number
        }
        Insert: {
          created_at?: string
          id?: number
          realtime_post_id: number
          score: number
          type?: Database["public"]["Enums"]["like_type"]
          updated_at?: string | null
          user_id: number
        }
        Update: {
          created_at?: string
          id?: number
          realtime_post_id?: number
          score?: number
          type?: Database["public"]["Enums"]["like_type"]
          updated_at?: string | null
          user_id?: number
        }
        Relationships: [
          {
            foreignKeyName: "realtime_likes_realtime_post_id_fkey"
            columns: ["realtime_post_id"]
            isOneToOne: false
            referencedRelation: "realtime_posts"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "realtime_likes_user_id_fkey"
            columns: ["user_id"]
            isOneToOne: false
            referencedRelation: "users"
            referencedColumns: ["id"]
          },
        ]
      }
      realtime_posts: {
        Row: {
          author_id: number
          caption: string | null
          collageColumns: number | null
          collageGap: number | null
          collageLayoutStyle: string | null
          content: string | null
          created_at: string
          expiration_date: string | null
          id: number
          image_url: string | null
          isPublic: boolean
          like_count: number
          locked: boolean
          parent_id: number | null
          pluginData: Json | null
          pluginType: string | null
          predictionMarketId: string | null
          realtime_room_id: string
          room_post_content: Json | null
          type: Database["public"]["Enums"]["realtime_post_type"]
          updated_at: string | null
          video_url: string | null
          x_coordinate: number
          y_coordinate: number
        }
        Insert: {
          author_id: number
          caption?: string | null
          collageColumns?: number | null
          collageGap?: number | null
          collageLayoutStyle?: string | null
          content?: string | null
          created_at?: string
          expiration_date?: string | null
          id?: number
          image_url?: string | null
          isPublic?: boolean
          like_count?: number
          locked: boolean
          parent_id?: number | null
          pluginData?: Json | null
          pluginType?: string | null
          predictionMarketId?: string | null
          realtime_room_id: string
          room_post_content?: Json | null
          type?: Database["public"]["Enums"]["realtime_post_type"]
          updated_at?: string | null
          video_url?: string | null
          x_coordinate: number
          y_coordinate: number
        }
        Update: {
          author_id?: number
          caption?: string | null
          collageColumns?: number | null
          collageGap?: number | null
          collageLayoutStyle?: string | null
          content?: string | null
          created_at?: string
          expiration_date?: string | null
          id?: number
          image_url?: string | null
          isPublic?: boolean
          like_count?: number
          locked?: boolean
          parent_id?: number | null
          pluginData?: Json | null
          pluginType?: string | null
          predictionMarketId?: string | null
          realtime_room_id?: string
          room_post_content?: Json | null
          type?: Database["public"]["Enums"]["realtime_post_type"]
          updated_at?: string | null
          video_url?: string | null
          x_coordinate?: number
          y_coordinate?: number
        }
        Relationships: [
          {
            foreignKeyName: "realtime_posts_author_id_fkey"
            columns: ["author_id"]
            isOneToOne: false
            referencedRelation: "users"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "realtime_posts_parent_id_fkey"
            columns: ["parent_id"]
            isOneToOne: false
            referencedRelation: "realtime_posts"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "realtime_posts_predictionMarketId_fkey"
            columns: ["predictionMarketId"]
            isOneToOne: false
            referencedRelation: "prediction_markets"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "realtime_posts_realtime_room_id_fkey"
            columns: ["realtime_room_id"]
            isOneToOne: false
            referencedRelation: "realtime_rooms"
            referencedColumns: ["id"]
          },
        ]
      }
      realtime_room_invite_tokens: {
        Row: {
          created_at: string
          expiration_date: string | null
          id: number
          inviting_user_id: number
          realtime_room_id: string
          token: string
        }
        Insert: {
          created_at?: string
          expiration_date?: string | null
          id?: number
          inviting_user_id: number
          realtime_room_id: string
          token: string
        }
        Update: {
          created_at?: string
          expiration_date?: string | null
          id?: number
          inviting_user_id?: number
          realtime_room_id?: string
          token?: string
        }
        Relationships: [
          {
            foreignKeyName: "realtime_room_invite_tokens_inviting_user_id_fkey"
            columns: ["inviting_user_id"]
            isOneToOne: false
            referencedRelation: "users"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "realtime_room_invite_tokens_realtime_room_id_fkey"
            columns: ["realtime_room_id"]
            isOneToOne: false
            referencedRelation: "realtime_rooms"
            referencedColumns: ["id"]
          },
        ]
      }
      realtime_rooms: {
        Row: {
          created_at: string
          id: string
          isLounge: boolean
          isPublic: boolean
          room_icon: string
        }
        Insert: {
          created_at?: string
          id: string
          isLounge?: boolean
          isPublic?: boolean
          room_icon: string
        }
        Update: {
          created_at?: string
          id?: string
          isLounge?: boolean
          isPublic?: boolean
          room_icon?: string
        }
        Relationships: []
      }
      recommendation_clicks: {
        Row: {
          created_at: string
          id: number
          recommended_room_id: string | null
          recommended_user_id: number | null
          user_id: number
        }
        Insert: {
          created_at?: string
          id?: number
          recommended_room_id?: string | null
          recommended_user_id?: number | null
          user_id: number
        }
        Update: {
          created_at?: string
          id?: number
          recommended_room_id?: string | null
          recommended_user_id?: number | null
          user_id?: number
        }
        Relationships: [
          {
            foreignKeyName: "recommendation_clicks_user_id_fkey"
            columns: ["user_id"]
            isOneToOne: false
            referencedRelation: "users"
            referencedColumns: ["id"]
          },
        ]
      }
      resolution_log: {
        Row: {
          createdAt: string
          id: number
          marketId: string
          outcome: Database["public"]["Enums"]["ResolutionOutcome"]
          resolverId: number
        }
        Insert: {
          createdAt?: string
          id?: number
          marketId: string
          outcome: Database["public"]["Enums"]["ResolutionOutcome"]
          resolverId: number
        }
        Update: {
          createdAt?: string
          id?: number
          marketId?: string
          outcome?: Database["public"]["Enums"]["ResolutionOutcome"]
          resolverId?: number
        }
        Relationships: [
          {
            foreignKeyName: "resolution_log_marketId_fkey"
            columns: ["marketId"]
            isOneToOne: false
            referencedRelation: "prediction_markets"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "resolution_log_resolverId_fkey"
            columns: ["resolverId"]
            isOneToOne: false
            referencedRelation: "users"
            referencedColumns: ["id"]
          },
        ]
      }
      Room: {
        Row: {
          conversation_id: number | null
          created_at: string
          id: string
          isSharded: boolean
          kind: Database["public"]["Enums"]["RoomKind"]
          kmsKeyArn: string | null
          mediaBucket: string | null
          realtime_room_id: string | null
          shardUrl: string | null
          updated_at: string
        }
        Insert: {
          conversation_id?: number | null
          created_at?: string
          id: string
          isSharded?: boolean
          kind: Database["public"]["Enums"]["RoomKind"]
          kmsKeyArn?: string | null
          mediaBucket?: string | null
          realtime_room_id?: string | null
          shardUrl?: string | null
          updated_at?: string
        }
        Update: {
          conversation_id?: number | null
          created_at?: string
          id?: string
          isSharded?: boolean
          kind?: Database["public"]["Enums"]["RoomKind"]
          kmsKeyArn?: string | null
          mediaBucket?: string | null
          realtime_room_id?: string | null
          shardUrl?: string | null
          updated_at?: string
        }
        Relationships: []
      }
      scheduled_workflows: {
        Row: {
          created_at: string
          cron: string | null
          id: number
          metadata: Json | null
          trigger: string | null
          updated_at: string
          workflow_id: number
        }
        Insert: {
          created_at?: string
          cron?: string | null
          id?: number
          metadata?: Json | null
          trigger?: string | null
          updated_at?: string
          workflow_id: number
        }
        Update: {
          created_at?: string
          cron?: string | null
          id?: number
          metadata?: Json | null
          trigger?: string | null
          updated_at?: string
          workflow_id?: number
        }
        Relationships: [
          {
            foreignKeyName: "scheduled_workflows_workflow_id_fkey"
            columns: ["workflow_id"]
            isOneToOne: false
            referencedRelation: "workflows"
            referencedColumns: ["id"]
          },
        ]
      }
      scroll_events: {
        Row: {
          content_id: string | null
          created_at: string
          dwell_ms: number
          id: number
          user_id: string
        }
        Insert: {
          content_id?: string | null
          created_at?: string
          dwell_ms: number
          id?: number
          user_id: string
        }
        Update: {
          content_id?: string | null
          created_at?: string
          dwell_ms?: number
          id?: number
          user_id?: string
        }
        Relationships: []
      }
      section: {
        Row: {
          auctionCount: number
          created_at: string
          id: number
          liveCount: number
          updated_at: string
          visitors: number
          x: number
          y: number
        }
        Insert: {
          auctionCount?: number
          created_at?: string
          id?: number
          liveCount?: number
          updated_at?: string
          visitors?: number
          x: number
          y: number
        }
        Update: {
          auctionCount?: number
          created_at?: string
          id?: number
          liveCount?: number
          updated_at?: string
          visitors?: number
          x?: number
          y?: number
        }
        Relationships: []
      }
      Seller: {
        Row: {
          id: number
          stripeAccountId: string | null
          stripeChargesEnabled: boolean
        }
        Insert: {
          id?: number
          stripeAccountId?: string | null
          stripeChargesEnabled?: boolean
        }
        Update: {
          id?: number
          stripeAccountId?: string | null
          stripeChargesEnabled?: boolean
        }
        Relationships: []
      }
      sheaf_attachments: {
        Row: {
          blobId: string
          createdAt: string
          facetId: number
          id: number
          name: string
        }
        Insert: {
          blobId: string
          createdAt?: string
          facetId: number
          id?: number
          name: string
        }
        Update: {
          blobId?: string
          createdAt?: string
          facetId?: number
          id?: number
          name?: string
        }
        Relationships: [
          {
            foreignKeyName: "sheaf_attachments_blobId_fkey"
            columns: ["blobId"]
            isOneToOne: false
            referencedRelation: "sheaf_blobs"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "sheaf_attachments_facetId_fkey"
            columns: ["facetId"]
            isOneToOne: false
            referencedRelation: "sheaf_facets"
            referencedColumns: ["id"]
          },
        ]
      }
      sheaf_audience_lists: {
        Row: {
          createdAt: string
          id: string
          memberIds: string[] | null
          name: string
          ownerId: number
          updatedAt: string
          version: number
        }
        Insert: {
          createdAt?: string
          id: string
          memberIds?: string[] | null
          name: string
          ownerId: number
          updatedAt?: string
          version?: number
        }
        Update: {
          createdAt?: string
          id?: string
          memberIds?: string[] | null
          name?: string
          ownerId?: number
          updatedAt?: string
          version?: number
        }
        Relationships: [
          {
            foreignKeyName: "sheaf_audience_lists_ownerId_fkey"
            columns: ["ownerId"]
            isOneToOne: false
            referencedRelation: "users"
            referencedColumns: ["id"]
          },
        ]
      }
      sheaf_blobs: {
        Row: {
          createdAt: string
          id: string
          mime: string
          path: string | null
          sha256: string
          size: number
        }
        Insert: {
          createdAt?: string
          id: string
          mime: string
          path?: string | null
          sha256: string
          size: number
        }
        Update: {
          createdAt?: string
          id?: string
          mime?: string
          path?: string | null
          sha256?: string
          size?: number
        }
        Relationships: []
      }
      sheaf_facets: {
        Row: {
          audienceKind: Database["public"]["Enums"]["AudienceKind"]
          audienceListId: string | null
          audienceMode: Database["public"]["Enums"]["AudienceMode"]
          audienceRole: string | null
          audienceUserIds: string[] | null
          body: Json
          createdAt: string
          expiresAt: string | null
          id: number
          listVersionAtSend: number | null
          messageId: number
          priorityRank: number
          sharePolicy: Database["public"]["Enums"]["SharePolicy"]
          snapshotMemberIds: string[] | null
          updatedAt: string
          visibilityKey: string | null
        }
        Insert: {
          audienceKind: Database["public"]["Enums"]["AudienceKind"]
          audienceListId?: string | null
          audienceMode: Database["public"]["Enums"]["AudienceMode"]
          audienceRole?: string | null
          audienceUserIds?: string[] | null
          body: Json
          createdAt?: string
          expiresAt?: string | null
          id?: number
          listVersionAtSend?: number | null
          messageId: number
          priorityRank?: number
          sharePolicy: Database["public"]["Enums"]["SharePolicy"]
          snapshotMemberIds?: string[] | null
          updatedAt: string
          visibilityKey?: string | null
        }
        Update: {
          audienceKind?: Database["public"]["Enums"]["AudienceKind"]
          audienceListId?: string | null
          audienceMode?: Database["public"]["Enums"]["AudienceMode"]
          audienceRole?: string | null
          audienceUserIds?: string[] | null
          body?: Json
          createdAt?: string
          expiresAt?: string | null
          id?: number
          listVersionAtSend?: number | null
          messageId?: number
          priorityRank?: number
          sharePolicy?: Database["public"]["Enums"]["SharePolicy"]
          snapshotMemberIds?: string[] | null
          updatedAt?: string
          visibilityKey?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "sheaf_facets_messageId_fkey"
            columns: ["messageId"]
            isOneToOne: false
            referencedRelation: "messages"
            referencedColumns: ["id"]
          },
        ]
      }
      sheaf_message_meta: {
        Row: {
          createdAt: string
          defaultFacetId: number | null
          messageId: number
          updatedAt: string
        }
        Insert: {
          createdAt?: string
          defaultFacetId?: number | null
          messageId: number
          updatedAt?: string
        }
        Update: {
          createdAt?: string
          defaultFacetId?: number | null
          messageId?: number
          updatedAt?: string
        }
        Relationships: [
          {
            foreignKeyName: "sheaf_message_meta_defaultFacetId_fkey"
            columns: ["defaultFacetId"]
            isOneToOne: false
            referencedRelation: "sheaf_facets"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "sheaf_message_meta_messageId_fkey"
            columns: ["messageId"]
            isOneToOne: true
            referencedRelation: "messages"
            referencedColumns: ["id"]
          },
        ]
      }
      stack_collaborators: {
        Row: {
          created_at: string
          role: Database["public"]["Enums"]["StackRole"]
          stack_id: string
          user_id: number
        }
        Insert: {
          created_at?: string
          role?: Database["public"]["Enums"]["StackRole"]
          stack_id: string
          user_id: number
        }
        Update: {
          created_at?: string
          role?: Database["public"]["Enums"]["StackRole"]
          stack_id?: string
          user_id?: number
        }
        Relationships: [
          {
            foreignKeyName: "stack_collaborators_stack_id_fkey"
            columns: ["stack_id"]
            isOneToOne: false
            referencedRelation: "stacks"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "stack_collaborators_user_id_fkey"
            columns: ["user_id"]
            isOneToOne: false
            referencedRelation: "users"
            referencedColumns: ["id"]
          },
        ]
      }
      stack_subscriptions: {
        Row: {
          created_at: string
          stack_id: string
          user_id: number
        }
        Insert: {
          created_at?: string
          stack_id: string
          user_id: number
        }
        Update: {
          created_at?: string
          stack_id?: string
          user_id?: number
        }
        Relationships: [
          {
            foreignKeyName: "stack_subscriptions_stack_id_fkey"
            columns: ["stack_id"]
            isOneToOne: false
            referencedRelation: "stacks"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "stack_subscriptions_user_id_fkey"
            columns: ["user_id"]
            isOneToOne: false
            referencedRelation: "users"
            referencedColumns: ["id"]
          },
        ]
      }
      stacks: {
        Row: {
          created_at: string
          description: string | null
          id: string
          is_public: boolean
          name: string
          order: string[] | null
          owner_id: number
          parent_id: string | null
          slug: string | null
        }
        Insert: {
          created_at?: string
          description?: string | null
          id: string
          is_public?: boolean
          name: string
          order?: string[] | null
          owner_id: number
          parent_id?: string | null
          slug?: string | null
        }
        Update: {
          created_at?: string
          description?: string | null
          id?: string
          is_public?: boolean
          name?: string
          order?: string[] | null
          owner_id?: number
          parent_id?: string | null
          slug?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "stacks_owner_id_fkey"
            columns: ["owner_id"]
            isOneToOne: false
            referencedRelation: "users"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "stacks_parent_id_fkey"
            columns: ["parent_id"]
            isOneToOne: false
            referencedRelation: "stacks"
            referencedColumns: ["id"]
          },
        ]
      }
      stall_heat: {
        Row: {
          cell: number
          id: number
          stall_id: number
          views: number
        }
        Insert: {
          cell: number
          id?: number
          stall_id: number
          views: number
        }
        Update: {
          cell?: number
          id?: number
          stall_id?: number
          views?: number
        }
        Relationships: []
      }
      stall_image: {
        Row: {
          blurhash: string | null
          created_at: string
          id: number
          position: number
          stall_id: number
          url: string
        }
        Insert: {
          blurhash?: string | null
          created_at?: string
          id?: number
          position?: number
          stall_id: number
          url: string
        }
        Update: {
          blurhash?: string | null
          created_at?: string
          id?: number
          position?: number
          stall_id?: number
          url?: string
        }
        Relationships: [
          {
            foreignKeyName: "stall_image_stall_id_fkey"
            columns: ["stall_id"]
            isOneToOne: false
            referencedRelation: "stalls"
            referencedColumns: ["id"]
          },
        ]
      }
      stall_messages: {
        Row: {
          created_at: string
          id: number
          stall_id: number
          text: string
          user_id: number
        }
        Insert: {
          created_at?: string
          id?: number
          stall_id: number
          text: string
          user_id: number
        }
        Update: {
          created_at?: string
          id?: number
          stall_id?: number
          text?: string
          user_id?: number
        }
        Relationships: [
          {
            foreignKeyName: "stall_messages_stall_id_fkey"
            columns: ["stall_id"]
            isOneToOne: false
            referencedRelation: "stalls"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "stall_messages_user_id_fkey"
            columns: ["user_id"]
            isOneToOne: false
            referencedRelation: "users"
            referencedColumns: ["id"]
          },
        ]
      }
      stalls: {
        Row: {
          created_at: string
          doc: Json | null
          id: number
          live: boolean
          liveSrc: string | null
          name: string
          owner_id: number
          section_id: number | null
          seller_id: number | null
          updated_at: string
        }
        Insert: {
          created_at?: string
          doc?: Json | null
          id?: number
          live?: boolean
          liveSrc?: string | null
          name: string
          owner_id: number
          section_id?: number | null
          seller_id?: number | null
          updated_at?: string
        }
        Update: {
          created_at?: string
          doc?: Json | null
          id?: number
          live?: boolean
          liveSrc?: string | null
          name?: string
          owner_id?: number
          section_id?: number | null
          seller_id?: number | null
          updated_at?: string
        }
        Relationships: [
          {
            foreignKeyName: "stalls_owner_id_fkey"
            columns: ["owner_id"]
            isOneToOne: false
            referencedRelation: "users"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "stalls_section_id_fkey"
            columns: ["section_id"]
            isOneToOne: false
            referencedRelation: "section"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "stalls_seller_id_fkey"
            columns: ["seller_id"]
            isOneToOne: false
            referencedRelation: "Seller"
            referencedColumns: ["id"]
          },
        ]
      }
      Telemetry: {
        Row: {
          coords: string
          createdAt: string
          event: string
          id: number
          userId: number | null
        }
        Insert: {
          coords: string
          createdAt?: string
          event: string
          id?: number
          userId?: number | null
        }
        Update: {
          coords?: string
          createdAt?: string
          event?: string
          id?: number
          userId?: number | null
        }
        Relationships: []
      }
      track_embedding: {
        Row: {
          createdAt: string
          track_id: string
          vector: string
        }
        Insert: {
          createdAt?: string
          track_id: string
          vector: string
        }
        Update: {
          createdAt?: string
          track_id?: string
          vector?: string
        }
        Relationships: []
      }
      user_attribute_edits: {
        Row: {
          created_at: string
          id: number
          user_id: number
        }
        Insert: {
          created_at?: string
          id?: number
          user_id: number
        }
        Update: {
          created_at?: string
          id?: number
          user_id?: number
        }
        Relationships: [
          {
            foreignKeyName: "user_attribute_edits_user_id_fkey"
            columns: ["user_id"]
            isOneToOne: false
            referencedRelation: "users"
            referencedColumns: ["id"]
          },
        ]
      }
      user_attributes: {
        Row: {
          albums: string[] | null
          artists: string[] | null
          birthday: string | null
          books: string[] | null
          communities: string[] | null
          created_at: string
          events_visibility: Database["public"]["Enums"]["visibility"]
          hobbies: string[] | null
          id: number
          interests: string[] | null
          location: string | null
          movies: string[] | null
          podcasts_visibility: Database["public"]["Enums"]["visibility"]
          songs: string[] | null
          tv_visibility: Database["public"]["Enums"]["visibility"]
          updated_at: string
          user_id: number
        }
        Insert: {
          albums?: string[] | null
          artists?: string[] | null
          birthday?: string | null
          books?: string[] | null
          communities?: string[] | null
          created_at?: string
          events_visibility?: Database["public"]["Enums"]["visibility"]
          hobbies?: string[] | null
          id?: number
          interests?: string[] | null
          location?: string | null
          movies?: string[] | null
          podcasts_visibility?: Database["public"]["Enums"]["visibility"]
          songs?: string[] | null
          tv_visibility?: Database["public"]["Enums"]["visibility"]
          updated_at?: string
          user_id: number
        }
        Update: {
          albums?: string[] | null
          artists?: string[] | null
          birthday?: string | null
          books?: string[] | null
          communities?: string[] | null
          created_at?: string
          events_visibility?: Database["public"]["Enums"]["visibility"]
          hobbies?: string[] | null
          id?: number
          interests?: string[] | null
          location?: string | null
          movies?: string[] | null
          podcasts_visibility?: Database["public"]["Enums"]["visibility"]
          songs?: string[] | null
          tv_visibility?: Database["public"]["Enums"]["visibility"]
          updated_at?: string
          user_id?: number
        }
        Relationships: [
          {
            foreignKeyName: "user_attributes_user_id_fkey"
            columns: ["user_id"]
            isOneToOne: false
            referencedRelation: "users"
            referencedColumns: ["id"]
          },
        ]
      }
      user_embeddings: {
        Row: {
          embedding: number[] | null
          updated_at: string
          user_id: number
        }
        Insert: {
          embedding?: number[] | null
          updated_at?: string
          user_id: number
        }
        Update: {
          embedding?: number[] | null
          updated_at?: string
          user_id?: number
        }
        Relationships: [
          {
            foreignKeyName: "user_embeddings_user_id_fkey"
            columns: ["user_id"]
            isOneToOne: true
            referencedRelation: "users"
            referencedColumns: ["id"]
          },
        ]
      }
      user_roles: {
        Row: {
          createdAt: string
          role: string
          userId: number
        }
        Insert: {
          createdAt?: string
          role: string
          userId: number
        }
        Update: {
          createdAt?: string
          role?: string
          userId?: number
        }
        Relationships: [
          {
            foreignKeyName: "user_roles_userId_fkey"
            columns: ["userId"]
            isOneToOne: false
            referencedRelation: "users"
            referencedColumns: ["id"]
          },
        ]
      }
      user_settings: {
        Row: {
          prefs: Json
          updated_at: string
          user_id: number
        }
        Insert: {
          prefs?: Json
          updated_at: string
          user_id: number
        }
        Update: {
          prefs?: Json
          updated_at?: string
          user_id?: number
        }
        Relationships: [
          {
            foreignKeyName: "user_settings_user_id_fkey"
            columns: ["user_id"]
            isOneToOne: true
            referencedRelation: "users"
            referencedColumns: ["id"]
          },
        ]
      }
      user_similarity_knn: {
        Row: {
          created_at: string
          neighbour_id: number
          sim: number
          user_id: number
        }
        Insert: {
          created_at?: string
          neighbour_id: number
          sim: number
          user_id: number
        }
        Update: {
          created_at?: string
          neighbour_id?: number
          sim?: number
          user_id?: number
        }
        Relationships: []
      }
      user_taste_vectors: {
        Row: {
          taste: string
          traits: Json | null
          updated_at: string
          user_id: number
        }
        Insert: {
          taste: string
          traits?: Json | null
          updated_at?: string
          user_id: number
        }
        Update: {
          taste?: string
          traits?: Json | null
          updated_at?: string
          user_id?: number
        }
        Relationships: []
      }
      users: {
        Row: {
          auth_id: string
          bio: string | null
          created_at: string
          id: number
          image: string | null
          name: string
          onboarded: boolean
          updated_at: string | null
          username: string
        }
        Insert: {
          auth_id: string
          bio?: string | null
          created_at?: string
          id?: number
          image?: string | null
          name: string
          onboarded?: boolean
          updated_at?: string | null
          username: string
        }
        Update: {
          auth_id?: string
          bio?: string | null
          created_at?: string
          id?: number
          image?: string | null
          name?: string
          onboarded?: boolean
          updated_at?: string | null
          username?: string
        }
        Relationships: []
      }
      users_realtime_rooms: {
        Row: {
          id: number
          joined_at: string
          realtime_room_id: string
          user_id: number
        }
        Insert: {
          id?: number
          joined_at?: string
          realtime_room_id: string
          user_id: number
        }
        Update: {
          id?: number
          joined_at?: string
          realtime_room_id?: string
          user_id?: number
        }
        Relationships: [
          {
            foreignKeyName: "users_realtime_rooms_realtime_room_id_fkey"
            columns: ["realtime_room_id"]
            isOneToOne: false
            referencedRelation: "realtime_rooms"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "users_realtime_rooms_user_id_fkey"
            columns: ["user_id"]
            isOneToOne: false
            referencedRelation: "users"
            referencedColumns: ["id"]
          },
        ]
      }
      wallet: {
        Row: {
          balanceCents: number
          lockedCents: number
          userId: number
        }
        Insert: {
          balanceCents?: number
          lockedCents?: number
          userId: number
        }
        Update: {
          balanceCents?: number
          lockedCents?: number
          userId?: number
        }
        Relationships: [
          {
            foreignKeyName: "wallet_userId_fkey"
            columns: ["userId"]
            isOneToOne: true
            referencedRelation: "users"
            referencedColumns: ["id"]
          },
        ]
      }
      workflow_run_steps: {
        Row: {
          action_ref: string | null
          attempt: number
          duration_ms: number | null
          error: Json | null
          finished_at: string | null
          id: number
          input: Json | null
          output: Json | null
          run_id: number
          started_at: string | null
          status: Database["public"]["Enums"]["StepStatus"]
          step_id: string
        }
        Insert: {
          action_ref?: string | null
          attempt?: number
          duration_ms?: number | null
          error?: Json | null
          finished_at?: string | null
          id?: number
          input?: Json | null
          output?: Json | null
          run_id: number
          started_at?: string | null
          status?: Database["public"]["Enums"]["StepStatus"]
          step_id: string
        }
        Update: {
          action_ref?: string | null
          attempt?: number
          duration_ms?: number | null
          error?: Json | null
          finished_at?: string | null
          id?: number
          input?: Json | null
          output?: Json | null
          run_id?: number
          started_at?: string | null
          status?: Database["public"]["Enums"]["StepStatus"]
          step_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "workflow_run_steps_run_id_fkey"
            columns: ["run_id"]
            isOneToOne: false
            referencedRelation: "workflow_runs"
            referencedColumns: ["id"]
          },
        ]
      }
      workflow_runs: {
        Row: {
          error: Json | null
          finished_at: string | null
          id: number
          started_at: string
          status: Database["public"]["Enums"]["WorkflowRunStatus"]
          trigger_kind: string | null
          trigger_payload: Json | null
          version: number
          workflow_id: number
        }
        Insert: {
          error?: Json | null
          finished_at?: string | null
          id?: number
          started_at?: string
          status?: Database["public"]["Enums"]["WorkflowRunStatus"]
          trigger_kind?: string | null
          trigger_payload?: Json | null
          version: number
          workflow_id: number
        }
        Update: {
          error?: Json | null
          finished_at?: string | null
          id?: number
          started_at?: string
          status?: Database["public"]["Enums"]["WorkflowRunStatus"]
          trigger_kind?: string | null
          trigger_payload?: Json | null
          version?: number
          workflow_id?: number
        }
        Relationships: [
          {
            foreignKeyName: "workflow_runs_workflow_id_fkey"
            columns: ["workflow_id"]
            isOneToOne: false
            referencedRelation: "workflows"
            referencedColumns: ["id"]
          },
        ]
      }
      workflow_states: {
        Row: {
          created_at: string
          graph: Json
          id: number
          updated_at: string | null
          version: number
          workflow_id: number
        }
        Insert: {
          created_at?: string
          graph: Json
          id?: number
          updated_at?: string | null
          version: number
          workflow_id: number
        }
        Update: {
          created_at?: string
          graph?: Json
          id?: number
          updated_at?: string | null
          version?: number
          workflow_id?: number
        }
        Relationships: [
          {
            foreignKeyName: "workflow_states_workflow_id_fkey"
            columns: ["workflow_id"]
            isOneToOne: false
            referencedRelation: "workflows"
            referencedColumns: ["id"]
          },
        ]
      }
      workflow_transitions: {
        Row: {
          created_at: string
          from_state_id: number
          id: number
          to_state_id: number
          version: number
          workflow_id: number
        }
        Insert: {
          created_at?: string
          from_state_id: number
          id?: number
          to_state_id: number
          version: number
          workflow_id: number
        }
        Update: {
          created_at?: string
          from_state_id?: number
          id?: number
          to_state_id?: number
          version?: number
          workflow_id?: number
        }
        Relationships: [
          {
            foreignKeyName: "workflow_transitions_from_state_id_fkey"
            columns: ["from_state_id"]
            isOneToOne: false
            referencedRelation: "workflow_states"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "workflow_transitions_to_state_id_fkey"
            columns: ["to_state_id"]
            isOneToOne: false
            referencedRelation: "workflow_states"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "workflow_transitions_workflow_id_fkey"
            columns: ["workflow_id"]
            isOneToOne: false
            referencedRelation: "workflows"
            referencedColumns: ["id"]
          },
        ]
      }
      workflow_versions: {
        Row: {
          created_at: string
          created_by: number | null
          dsl: Json
          id: number
          version: number
          workflow_id: number
        }
        Insert: {
          created_at?: string
          created_by?: number | null
          dsl: Json
          id?: number
          version: number
          workflow_id: number
        }
        Update: {
          created_at?: string
          created_by?: number | null
          dsl?: Json
          id?: number
          version?: number
          workflow_id?: number
        }
        Relationships: [
          {
            foreignKeyName: "workflow_versions_workflow_id_fkey"
            columns: ["workflow_id"]
            isOneToOne: false
            referencedRelation: "workflows"
            referencedColumns: ["id"]
          },
        ]
      }
      workflows: {
        Row: {
          created_at: string
          current_version: number
          id: number
          is_active: boolean
          name: string
          owner_id: number
          updated_at: string
        }
        Insert: {
          created_at?: string
          current_version?: number
          id?: number
          is_active?: boolean
          name: string
          owner_id: number
          updated_at?: string
        }
        Update: {
          created_at?: string
          current_version?: number
          id?: number
          is_active?: boolean
          name?: string
          owner_id?: number
          updated_at?: string
        }
        Relationships: [
          {
            foreignKeyName: "workflows_owner_id_fkey"
            columns: ["owner_id"]
            isOneToOne: false
            referencedRelation: "users"
            referencedColumns: ["id"]
          },
        ]
      }
      workspace_settings: {
        Row: {
          prefs: Json
          updated_at: string
          workspace_id: number
        }
        Insert: {
          prefs?: Json
          updated_at: string
          workspace_id: number
        }
        Update: {
          prefs?: Json
          updated_at?: string
          workspace_id?: number
        }
        Relationships: []
      }
    }
    Views: {
      user_dwell_avg: {
        Row: {
          avg_dwell_ms: number | null
          user_id: string | null
        }
        Relationships: []
      }
    }
    Functions: {
      lock_wallet: {
        Args: { uid: number }
        Returns: undefined
      }
    }
    Enums: {
      ApDomainRuleMode: "ALLOW" | "DENY"
      ApFollowState: "PENDING" | "ACCEPTED" | "REJECTED"
      ArticleStatus: "DRAFT" | "PUBLISHED"
      auction_state: "LIVE" | "CLOSED"
      AudienceKind: "EVERYONE" | "ROLE" | "LIST" | "USERS"
      AudienceMode: "DYNAMIC" | "SNAPSHOT"
      DriftKind: "DRIFT" | "THREAD" | "PROPOSAL"
      escrow_state: "PENDING" | "HELD" | "RELEASED" | "REFUNDED"
      feed_post_type:
        | "TEXT"
        | "IMAGE"
        | "VIDEO"
        | "GALLERY"
        | "PREDICTION"
        | "PRODUCT_REVIEW"
        | "LIVESTREAM"
        | "IMAGE_COMPUTE"
        | "COLLAGE"
        | "PORTAL"
        | "AUDIO"
        | "DRAW"
        | "LIVECHAT"
        | "DOCUMENT"
        | "THREAD"
        | "CODE"
        | "PORTFOLIO"
        | "LLM_INSTRUCTION"
        | "PLUGIN"
        | "ENTROPY"
        | "MUSIC"
        | "ROOM_CANVAS"
        | "ARTICLE"
        | "LIBRARY"
      IntegrationStatus: "CONNECTED" | "NEEDS_REAUTH" | "REVOKED"
      like_type: "LIKE" | "DISLIKE"
      MarketOutcome: "YES" | "NO"
      notification_type:
        | "FOLLOW"
        | "MESSAGE"
        | "TRADE_EXECUTED"
        | "MARKET_RESOLVED"
      OfferEventKind:
        | "CREATED"
        | "COUNTERED"
        | "ACCEPTED"
        | "REJECTED"
        | "EXPIRED"
      OfferStatus: "PENDING" | "ACCEPTED" | "REJECTED" | "EXPIRED"
      OrderStatus:
        | "PENDING_PAYMENT"
        | "AUTHORIZED"
        | "PAID"
        | "FULFILLED"
        | "RELEASED"
        | "DISPUTED"
        | "REFUNDED"
        | "CANCELLED"
      PollKind: "OPTIONS" | "TEMP"
      PredictionState: "OPEN" | "CLOSED" | "RESOLVED"
      realtime_post_type:
        | "TEXT"
        | "VIDEO"
        | "IMAGE"
        | "LIVESTREAM"
        | "IMAGE_COMPUTE"
        | "COLLAGE"
        | "GALLERY"
        | "PORTAL"
        | "AUDIO"
        | "DRAW"
        | "LIVECHAT"
        | "DOCUMENT"
        | "THREAD"
        | "CODE"
        | "PORTFOLIO"
        | "LLM_INSTRUCTION"
        | "PLUGIN"
        | "PRODUCT_REVIEW"
        | "ENTROPY"
        | "MUSIC"
        | "ROOM_CANVAS"
        | "PREDICTION"
      ResolutionOutcome: "YES" | "NO" | "N_A"
      RoomKind: "CONVERSATION" | "REALTIME"
      SharePolicy: "ALLOW" | "REDACT" | "FORBID"
      StackRole: "OWNER" | "EDITOR" | "VIEWER"
      StepStatus: "PENDING" | "RUNNING" | "SUCCEEDED" | "FAILED" | "SKIPPED"
      visibility: "PUBLIC" | "FOLLOWERS" | "PRIVATE"
      WorkflowRunStatus:
        | "PENDING"
        | "RUNNING"
        | "SUCCEEDED"
        | "FAILED"
        | "CANCELLED"
        | "PAUSED"
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
  graphql_public: {
    Enums: {},
  },
  public: {
    Enums: {
      ApDomainRuleMode: ["ALLOW", "DENY"],
      ApFollowState: ["PENDING", "ACCEPTED", "REJECTED"],
      ArticleStatus: ["DRAFT", "PUBLISHED"],
      auction_state: ["LIVE", "CLOSED"],
      AudienceKind: ["EVERYONE", "ROLE", "LIST", "USERS"],
      AudienceMode: ["DYNAMIC", "SNAPSHOT"],
      DriftKind: ["DRIFT", "THREAD", "PROPOSAL"],
      escrow_state: ["PENDING", "HELD", "RELEASED", "REFUNDED"],
      feed_post_type: [
        "TEXT",
        "IMAGE",
        "VIDEO",
        "GALLERY",
        "PREDICTION",
        "PRODUCT_REVIEW",
        "LIVESTREAM",
        "IMAGE_COMPUTE",
        "COLLAGE",
        "PORTAL",
        "AUDIO",
        "DRAW",
        "LIVECHAT",
        "DOCUMENT",
        "THREAD",
        "CODE",
        "PORTFOLIO",
        "LLM_INSTRUCTION",
        "PLUGIN",
        "ENTROPY",
        "MUSIC",
        "ROOM_CANVAS",
        "ARTICLE",
        "LIBRARY",
      ],
      IntegrationStatus: ["CONNECTED", "NEEDS_REAUTH", "REVOKED"],
      like_type: ["LIKE", "DISLIKE"],
      MarketOutcome: ["YES", "NO"],
      notification_type: [
        "FOLLOW",
        "MESSAGE",
        "TRADE_EXECUTED",
        "MARKET_RESOLVED",
      ],
      OfferEventKind: [
        "CREATED",
        "COUNTERED",
        "ACCEPTED",
        "REJECTED",
        "EXPIRED",
      ],
      OfferStatus: ["PENDING", "ACCEPTED", "REJECTED", "EXPIRED"],
      OrderStatus: [
        "PENDING_PAYMENT",
        "AUTHORIZED",
        "PAID",
        "FULFILLED",
        "RELEASED",
        "DISPUTED",
        "REFUNDED",
        "CANCELLED",
      ],
      PollKind: ["OPTIONS", "TEMP"],
      PredictionState: ["OPEN", "CLOSED", "RESOLVED"],
      realtime_post_type: [
        "TEXT",
        "VIDEO",
        "IMAGE",
        "LIVESTREAM",
        "IMAGE_COMPUTE",
        "COLLAGE",
        "GALLERY",
        "PORTAL",
        "AUDIO",
        "DRAW",
        "LIVECHAT",
        "DOCUMENT",
        "THREAD",
        "CODE",
        "PORTFOLIO",
        "LLM_INSTRUCTION",
        "PLUGIN",
        "PRODUCT_REVIEW",
        "ENTROPY",
        "MUSIC",
        "ROOM_CANVAS",
        "PREDICTION",
      ],
      ResolutionOutcome: ["YES", "NO", "N_A"],
      RoomKind: ["CONVERSATION", "REALTIME"],
      SharePolicy: ["ALLOW", "REDACT", "FORBID"],
      StackRole: ["OWNER", "EDITOR", "VIEWER"],
      StepStatus: ["PENDING", "RUNNING", "SUCCEEDED", "FAILED", "SKIPPED"],
      visibility: ["PUBLIC", "FOLLOWERS", "PRIVATE"],
      WorkflowRunStatus: [
        "PENDING",
        "RUNNING",
        "SUCCEEDED",
        "FAILED",
        "CANCELLED",
        "PAUSED",
      ],
    },
  },
} as const
