export type Json =
  | string
  | number
  | boolean
  | null
  | { [key: string]: Json | undefined }
  | Json[];

export type UserRole = 'customer' | 'admin' | 'super_admin';
export type AccountStatus = 'active' | 'suspended' | 'pending';
export type PostType = 'blog' | 'poster' | 'photo';
export type PostStatus = 'draft' | 'published' | 'archived';
export type ConversationStatus = 'open' | 'in_progress' | 'resolved' | 'closed';
export type AssignmentStatus = 'active' | 'removed';
export type MessageType = 'text' | 'system' | 'media';
export type InquiryStatus = 'new' | 'in_progress' | 'replied' | 'closed';
export type EmailDeliveryStatus =
  | 'pending'
  | 'queued'
  | 'accepted'
  | 'sent'
  | 'delivered'
  | 'bounced'
  | 'failed';

export interface Database {
  public: {
    Tables: {
      profiles: {
        Row: {
          id: string;
          email: string | null;
          phone: string | null;
          display_name: string;
          role: UserRole;
          account_status: AccountStatus;
          created_at: string;
          updated_at: string;
        };
        Insert: {
          id: string;
          email?: string | null;
          phone?: string | null;
          display_name?: string;
          role?: UserRole;
          account_status?: AccountStatus;
          created_at?: string;
          updated_at?: string;
        };
        Update: {
          id?: string;
          email?: string | null;
          phone?: string | null;
          display_name?: string;
          role?: UserRole;
          account_status?: AccountStatus;
          created_at?: string;
          updated_at?: string;
        };
        Relationships: [];
      };
      posts: {
        Row: {
          id: string;
          author_id: string;
          title: string;
          slug: string;
          excerpt: string | null;
          body: string | null;
          post_type: PostType;
          status: PostStatus;
          cover_image: string | null;
          published_at: string | null;
          created_at: string;
          updated_at: string;
        };
        Insert: {
          id?: string;
          author_id: string;
          title: string;
          slug: string;
          excerpt?: string | null;
          body?: string | null;
          post_type: PostType;
          status?: PostStatus;
          cover_image?: string | null;
          published_at?: string | null;
          created_at?: string;
          updated_at?: string;
        };
        Update: {
          id?: string;
          author_id?: string;
          title?: string;
          slug?: string;
          excerpt?: string | null;
          body?: string | null;
          post_type?: PostType;
          status?: PostStatus;
          cover_image?: string | null;
          published_at?: string | null;
          created_at?: string;
          updated_at?: string;
        };
        Relationships: [];
      };
      post_media: {
        Row: {
          id: string;
          post_id: string;
          storage_path: string;
          media_type: string;
          alt_text: string | null;
          sort_order: number;
          created_at: string;
        };
        Insert: {
          id?: string;
          post_id: string;
          storage_path: string;
          media_type: string;
          alt_text?: string | null;
          sort_order?: number;
          created_at?: string;
        };
        Update: {
          id?: string;
          post_id?: string;
          storage_path?: string;
          media_type?: string;
          alt_text?: string | null;
          sort_order?: number;
          created_at?: string;
        };
        Relationships: [];
      };
      conversations: {
        Row: {
          id: string;
          customer_id: string;
          subject: string | null;
          status: ConversationStatus;
          last_message_at: string;
          closed_at: string | null;
          created_at: string;
          updated_at: string;
        };
        Insert: {
          id?: string;
          customer_id: string;
          subject?: string | null;
          status?: ConversationStatus;
          last_message_at?: string;
          closed_at?: string | null;
          created_at?: string;
          updated_at?: string;
        };
        Update: {
          id?: string;
          customer_id?: string;
          subject?: string | null;
          status?: ConversationStatus;
          last_message_at?: string;
          closed_at?: string | null;
          created_at?: string;
          updated_at?: string;
        };
        Relationships: [];
      };
      conversation_assignments: {
        Row: {
          id: string;
          conversation_id: string;
          admin_id: string;
          assigned_by: string | null;
          status: AssignmentStatus;
          assigned_at: string;
          removed_at: string | null;
        };
        Insert: {
          id?: string;
          conversation_id: string;
          admin_id: string;
          assigned_by?: string | null;
          status?: AssignmentStatus;
          assigned_at?: string;
          removed_at?: string | null;
        };
        Update: {
          id?: string;
          conversation_id?: string;
          admin_id?: string;
          assigned_by?: string | null;
          status?: AssignmentStatus;
          assigned_at?: string;
          removed_at?: string | null;
        };
        Relationships: [];
      };
      messages: {
        Row: {
          id: string;
          conversation_id: string;
          sender_id: string;
          body: string;
          message_type: MessageType;
          created_at: string;
          edited_at: string | null;
        };
        Insert: {
          id?: string;
          conversation_id: string;
          sender_id: string;
          body: string;
          message_type?: MessageType;
          created_at?: string;
          edited_at?: string | null;
        };
        Update: {
          id?: string;
          conversation_id?: string;
          sender_id?: string;
          body?: string;
          message_type?: MessageType;
          created_at?: string;
          edited_at?: string | null;
        };
        Relationships: [];
      };
      contact_inquiries: {
        Row: {
          id: string;
          name: string | null;
          email: string;
          phone: string;
          message: string;
          status: InquiryStatus;
          assigned_admin_id: string | null;
          replied_at: string | null;
          closed_at: string | null;
          created_at: string;
          updated_at: string;
        };
        Insert: {
          id?: string;
          name?: string | null;
          email: string;
          phone: string;
          message: string;
          status?: InquiryStatus;
          assigned_admin_id?: string | null;
          replied_at?: string | null;
          closed_at?: string | null;
          created_at?: string;
          updated_at?: string;
        };
        Update: {
          id?: string;
          name?: string | null;
          email?: string;
          phone?: string;
          message?: string;
          status?: InquiryStatus;
          assigned_admin_id?: string | null;
          replied_at?: string | null;
          closed_at?: string | null;
          created_at?: string;
          updated_at?: string;
        };
        Relationships: [];
      };
      contact_inquiry_replies: {
        Row: {
          id: string;
          inquiry_id: string;
          admin_id: string;
          body: string;
          email_delivery_status: EmailDeliveryStatus;
          provider_message_id: string | null;
          last_delivery_error: string | null;
          idempotency_key: string | null;
          retry_count: number;
          last_attempted_at: string | null;
          sent_at: string | null;
          created_at: string;
        };
        Insert: {
          id?: string;
          inquiry_id: string;
          admin_id: string;
          body: string;
          email_delivery_status?: EmailDeliveryStatus;
          provider_message_id?: string | null;
          last_delivery_error?: string | null;
          idempotency_key?: string | null;
          retry_count?: number;
          last_attempted_at?: string | null;
          sent_at?: string | null;
          created_at?: string;
        };
        Update: {
          id?: string;
          inquiry_id?: string;
          admin_id?: string;
          body?: string;
          email_delivery_status?: EmailDeliveryStatus;
          provider_message_id?: string | null;
          last_delivery_error?: string | null;
          idempotency_key?: string | null;
          retry_count?: number;
          last_attempted_at?: string | null;
          sent_at?: string | null;
          created_at?: string;
        };
        Relationships: [];
      };
      audit_logs: {
        Row: {
          id: string;
          actor_id: string | null;
          action: string;
          target_type: string;
          target_id: string | null;
          metadata: Json;
          created_at: string;
        };
        Insert: {
          id?: string;
          actor_id?: string | null;
          action: string;
          target_type: string;
          target_id?: string | null;
          metadata?: Json;
          created_at?: string;
        };
        Update: {
          id?: string;
          actor_id?: string | null;
          action?: string;
          target_type?: string;
          target_id?: string | null;
          metadata?: Json;
          created_at?: string;
        };
        Relationships: [];
      };
    };
    Views: Record<string, never>;
    Functions: Record<string, never>;
    Enums: Record<string, never>;
    CompositeTypes: Record<string, never>;
  };
}
