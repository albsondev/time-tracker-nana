export type Json =
  | string
  | number
  | boolean
  | null
  | { [key: string]: Json | undefined }
  | Json[];

export type Database = {
  public: {
    Tables: {
      profiles: {
        Row: {
          id: string;
          display_name: string | null;
          created_at: string;
        };
        Insert: {
          id: string;
          display_name?: string | null;
          created_at?: string;
        };
        Update: {
          display_name?: string | null;
        };
      };
      time_entries: {
        Row: {
          id: string;
          user_id: string;
          occurred_at: string;
          type: string;
          note: string | null;
          is_modified: boolean;
          modified_at: string | null;
          created_at: string;
        };
        Insert: {
          id?: string;
          user_id: string;
          occurred_at: string;
          type: string;
          note?: string | null;
          is_modified?: boolean;
          modified_at?: string | null;
          created_at?: string;
        };
        Update: {
          occurred_at?: string;
          type?: string;
          note?: string | null;
          is_modified?: boolean;
          modified_at?: string | null;
        };
      };
      break_entries: {
        Row: {
          id: string;
          user_id: string;
          work_date: string;
          category: string;
          starts_at: string;
          ends_at: string | null;
          deducts_from_work: boolean;
          note: string | null;
          is_modified: boolean;
          modified_at: string | null;
          created_at: string;
        };
        Insert: {
          id?: string;
          user_id: string;
          work_date: string;
          category: string;
          starts_at: string;
          ends_at?: string | null;
          deducts_from_work?: boolean;
          note?: string | null;
          is_modified?: boolean;
          modified_at?: string | null;
          created_at?: string;
        };
        Update: {
          category?: string;
          starts_at?: string;
          ends_at?: string | null;
          deducts_from_work?: boolean;
          note?: string | null;
          work_date?: string;
          is_modified?: boolean;
          modified_at?: string | null;
        };
      };
      hour_bank_movements: {
        Row: {
          id: string;
          user_id: string;
          movement_date: string;
          source: string;
          minutes_delta: number;
          description: string;
          created_at: string;
        };
        Insert: {
          id?: string;
          user_id: string;
          movement_date: string;
          source: string;
          minutes_delta: number;
          description: string;
          created_at?: string;
        };
        Update: {
          movement_date?: string;
          source?: string;
          minutes_delta?: number;
          description?: string;
        };
      };
    };
  };
};
