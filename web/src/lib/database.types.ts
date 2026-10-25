// Types for the database in ../../supabase/migrations.
// Same shape as `supabase gen types typescript` output — regenerate after schema changes:
//   npx supabase gen types typescript --project-id <your-project-id> > src/lib/database.types.ts

export type Json = string | number | boolean | null | { [key: string]: Json | undefined } | Json[];

type Timestamps = { created_at: string; updated_at: string };

export type Database = {
  __InternalSupabase: { PostgrestVersion: "13" };
  public: {
    Tables: {
      profiles: {
        Row: { id: string; full_name: string | null; locale: Database["public"]["Enums"]["app_locale"]; currency: string } & Timestamps;
        Insert: { id: string; full_name?: string | null; locale?: Database["public"]["Enums"]["app_locale"]; currency?: string; created_at?: string; updated_at?: string };
        Update: { full_name?: string | null; locale?: Database["public"]["Enums"]["app_locale"]; currency?: string };
        Relationships: [];
      };
      companies: {
        Row: { id: string; owner_id: string; name: string; website: string | null; industry: string | null; phone: string | null; address: string | null } & Timestamps;
        Insert: { id?: string; owner_id?: string; name: string; website?: string | null; industry?: string | null; phone?: string | null; address?: string | null; created_at?: string; updated_at?: string };
        Update: { name?: string; website?: string | null; industry?: string | null; phone?: string | null; address?: string | null };
        Relationships: [];
      };
      contacts: {
        Row: {
          id: string;
          owner_id: string;
          company_id: string | null;
          first_name: string;
          last_name: string | null;
          email: string | null;
          phone: string | null;
          position: string | null;
          status: Database["public"]["Enums"]["contact_status"];
          source: Database["public"]["Enums"]["contact_source"] | null;
          tags: string[];
        } & Timestamps;
        Insert: {
          id?: string;
          owner_id?: string;
          company_id?: string | null;
          first_name: string;
          last_name?: string | null;
          email?: string | null;
          phone?: string | null;
          position?: string | null;
          status?: Database["public"]["Enums"]["contact_status"];
          source?: Database["public"]["Enums"]["contact_source"] | null;
          tags?: string[];
          created_at?: string;
          updated_at?: string;
        };
        Update: {
          company_id?: string | null;
          first_name?: string;
          last_name?: string | null;
          email?: string | null;
          phone?: string | null;
          position?: string | null;
          status?: Database["public"]["Enums"]["contact_status"];
          source?: Database["public"]["Enums"]["contact_source"] | null;
          tags?: string[];
        };
        Relationships: [
          {
            foreignKeyName: "contacts_company_id_owner_id_fkey";
            columns: ["company_id", "owner_id"];
            isOneToOne: false;
            referencedRelation: "companies";
            referencedColumns: ["id", "owner_id"];
          },
        ];
      };
      pipeline_stages: {
        Row: { id: string; owner_id: string; key: string | null; name: string | null; position: number; kind: Database["public"]["Enums"]["stage_kind"]; probability: number } & Timestamps;
        Insert: { id?: string; owner_id?: string; key?: string | null; name?: string | null; position: number; kind?: Database["public"]["Enums"]["stage_kind"]; probability?: number };
        Update: { key?: string | null; name?: string | null; position?: number; kind?: Database["public"]["Enums"]["stage_kind"]; probability?: number };
        Relationships: [];
      };
      deals: {
        Row: {
          id: string;
          owner_id: string;
          title: string;
          amount: number;
          currency: string;
          stage_id: string;
          contact_id: string | null;
          company_id: string | null;
          position: number;
          expected_close_date: string | null;
          closed_at: string | null;
        } & Timestamps;
        Insert: {
          id?: string;
          owner_id?: string;
          title: string;
          amount?: number;
          currency?: string;
          stage_id: string;
          contact_id?: string | null;
          company_id?: string | null;
          position?: number;
          expected_close_date?: string | null;
          closed_at?: string | null;
        };
        Update: {
          title?: string;
          amount?: number;
          currency?: string;
          stage_id?: string;
          contact_id?: string | null;
          company_id?: string | null;
          position?: number;
          expected_close_date?: string | null;
          closed_at?: string | null;
        };
        Relationships: [
          { foreignKeyName: "deals_stage_id_owner_id_fkey"; columns: ["stage_id", "owner_id"]; isOneToOne: false; referencedRelation: "pipeline_stages"; referencedColumns: ["id", "owner_id"] },
          { foreignKeyName: "deals_contact_id_owner_id_fkey"; columns: ["contact_id", "owner_id"]; isOneToOne: false; referencedRelation: "contacts"; referencedColumns: ["id", "owner_id"] },
          { foreignKeyName: "deals_company_id_owner_id_fkey"; columns: ["company_id", "owner_id"]; isOneToOne: false; referencedRelation: "companies"; referencedColumns: ["id", "owner_id"] },
        ];
      };
      deal_stage_history: {
        Row: { id: number; owner_id: string; deal_id: string; from_stage_id: string | null; to_stage_id: string; changed_at: string };
        Insert: { owner_id: string; deal_id: string; from_stage_id?: string | null; to_stage_id: string; changed_at?: string };
        Update: never;
        Relationships: [
          { foreignKeyName: "deal_stage_history_deal_id_owner_id_fkey"; columns: ["deal_id", "owner_id"]; isOneToOne: false; referencedRelation: "deals"; referencedColumns: ["id", "owner_id"] },
        ];
      };
      tasks: {
        Row: {
          id: string;
          owner_id: string;
          title: string;
          description: string | null;
          priority: Database["public"]["Enums"]["task_priority"];
          due_at: string | null;
          completed_at: string | null;
          contact_id: string | null;
          deal_id: string | null;
        } & Timestamps;
        Insert: {
          id?: string;
          owner_id?: string;
          title: string;
          description?: string | null;
          priority?: Database["public"]["Enums"]["task_priority"];
          due_at?: string | null;
          completed_at?: string | null;
          contact_id?: string | null;
          deal_id?: string | null;
        };
        Update: {
          title?: string;
          description?: string | null;
          priority?: Database["public"]["Enums"]["task_priority"];
          due_at?: string | null;
          completed_at?: string | null;
          contact_id?: string | null;
          deal_id?: string | null;
        };
        Relationships: [
          { foreignKeyName: "tasks_contact_id_owner_id_fkey"; columns: ["contact_id", "owner_id"]; isOneToOne: false; referencedRelation: "contacts"; referencedColumns: ["id", "owner_id"] },
          { foreignKeyName: "tasks_deal_id_owner_id_fkey"; columns: ["deal_id", "owner_id"]; isOneToOne: false; referencedRelation: "deals"; referencedColumns: ["id", "owner_id"] },
        ];
      };
      activities: {
        Row: {
          id: string;
          owner_id: string;
          type: Database["public"]["Enums"]["activity_type"];
          body: string;
          contact_id: string | null;
          deal_id: string | null;
          occurred_at: string;
          created_at: string;
        };
        Insert: {
          id?: string;
          owner_id?: string;
          type?: Database["public"]["Enums"]["activity_type"];
          body: string;
          contact_id?: string | null;
          deal_id?: string | null;
          occurred_at?: string;
        };
        Update: {
          type?: Database["public"]["Enums"]["activity_type"];
          body?: string;
          contact_id?: string | null;
          deal_id?: string | null;
          occurred_at?: string;
        };
        Relationships: [
          { foreignKeyName: "activities_contact_id_owner_id_fkey"; columns: ["contact_id", "owner_id"]; isOneToOne: false; referencedRelation: "contacts"; referencedColumns: ["id", "owner_id"] },
          { foreignKeyName: "activities_deal_id_owner_id_fkey"; columns: ["deal_id", "owner_id"]; isOneToOne: false; referencedRelation: "deals"; referencedColumns: ["id", "owner_id"] },
        ];
      };
    };
    Views: {
      pipeline_summary: {
        Row: {
          stage_id: string;
          key: string | null;
          name: string | null;
          position: number;
          kind: Database["public"]["Enums"]["stage_kind"];
          probability: number;
          deals_count: number;
          total_amount: number;
          weighted_amount: number;
        };
        Relationships: [];
      };
      monthly_sales: {
        Row: {
          month: string;
          won_count: number;
          lost_count: number;
          won_amount: number;
          avg_won_amount: number | null;
          win_rate_pct: number | null;
        };
        Relationships: [];
      };
      funnel: {
        Row: { stage_id: string; key: string | null; name: string | null; position: number; deals_reached: number };
        Relationships: [];
      };
      closed_deals: {
        Row: {
          id: string;
          owner_id: string;
          title: string;
          amount: number;
          outcome: Database["public"]["Enums"]["stage_kind"];
          created_at: string;
          closed_at: string;
          cycle_days: number;
          source: Database["public"]["Enums"]["contact_source"] | null;
        };
        Relationships: [];
      };
      sales_cycle_summary: {
        Row: {
          outcome: Database["public"]["Enums"]["stage_kind"];
          deals: number;
          avg_days: number;
          median_days: number;
          p25_days: number;
          p75_days: number;
        };
        Relationships: [];
      };
      stage_durations: {
        Row: {
          stage_id: string;
          key: string | null;
          name: string | null;
          position: number;
          stays: number;
          avg_days: number | null;
          median_days: number | null;
        };
        Relationships: [];
      };
      source_performance: {
        Row: {
          source: Database["public"]["Enums"]["contact_source"];
          deals: number;
          won: number;
          lost: number;
          open: number;
          win_rate_pct: number | null;
          won_amount: number;
          avg_won_amount: number | null;
          median_days_to_win: number | null;
        };
        Relationships: [];
      };
    };
    Functions: { [_ in never]: never };
    Enums: {
      app_locale: "he" | "en";
      contact_status: "lead" | "customer" | "inactive";
      contact_source: "website" | "referral" | "social" | "ads" | "event" | "cold" | "other";
      stage_kind: "open" | "won" | "lost";
      task_priority: "low" | "medium" | "high";
      activity_type: "note" | "call" | "email" | "meeting";
    };
    CompositeTypes: { [_ in never]: never };
  };
};

export type Enums<T extends keyof Database["public"]["Enums"]> = Database["public"]["Enums"][T];
export type Tables<T extends keyof Database["public"]["Tables"]> = Database["public"]["Tables"][T]["Row"];
