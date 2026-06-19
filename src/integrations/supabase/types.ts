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
    PostgrestVersion: "14.5"
  }
  public: {
    Tables: {
      asset_categories: {
        Row: {
          color: string | null
          icon: string | null
          id: string
          name: string
        }
        Insert: {
          color?: string | null
          icon?: string | null
          id?: string
          name: string
        }
        Update: {
          color?: string | null
          icon?: string | null
          id?: string
          name?: string
        }
        Relationships: []
      }
      asset_documents: {
        Row: {
          asset_id: string
          category: string
          created_at: string
          description: string | null
          expires_at: string | null
          file_path: string
          file_size_kb: number | null
          id: string
          issued_at: string | null
          mime: string | null
          structure_id: string | null
          superseded_by: string | null
          title: string
          updated_at: string
          uploaded_by: string | null
          version: number
        }
        Insert: {
          asset_id: string
          category?: string
          created_at?: string
          description?: string | null
          expires_at?: string | null
          file_path: string
          file_size_kb?: number | null
          id?: string
          issued_at?: string | null
          mime?: string | null
          structure_id?: string | null
          superseded_by?: string | null
          title: string
          updated_at?: string
          uploaded_by?: string | null
          version?: number
        }
        Update: {
          asset_id?: string
          category?: string
          created_at?: string
          description?: string | null
          expires_at?: string | null
          file_path?: string
          file_size_kb?: number | null
          id?: string
          issued_at?: string | null
          mime?: string | null
          structure_id?: string | null
          superseded_by?: string | null
          title?: string
          updated_at?: string
          uploaded_by?: string | null
          version?: number
        }
        Relationships: [
          {
            foreignKeyName: "asset_documents_asset_id_fkey"
            columns: ["asset_id"]
            isOneToOne: false
            referencedRelation: "assets"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "asset_documents_structure_id_fkey"
            columns: ["structure_id"]
            isOneToOne: false
            referencedRelation: "structures"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "asset_documents_superseded_by_fkey"
            columns: ["superseded_by"]
            isOneToOne: false
            referencedRelation: "asset_documents"
            referencedColumns: ["id"]
          },
        ]
      }
      asset_media: {
        Row: {
          asset_id: string
          caption: string | null
          created_at: string
          file_path: string
          file_size_kb: number | null
          id: string
          kind: string
          mime: string | null
          structure_id: string | null
          taken_at: string | null
          thumbnail_path: string | null
          title: string | null
          uploaded_by: string | null
        }
        Insert: {
          asset_id: string
          caption?: string | null
          created_at?: string
          file_path: string
          file_size_kb?: number | null
          id?: string
          kind: string
          mime?: string | null
          structure_id?: string | null
          taken_at?: string | null
          thumbnail_path?: string | null
          title?: string | null
          uploaded_by?: string | null
        }
        Update: {
          asset_id?: string
          caption?: string | null
          created_at?: string
          file_path?: string
          file_size_kb?: number | null
          id?: string
          kind?: string
          mime?: string | null
          structure_id?: string | null
          taken_at?: string | null
          thumbnail_path?: string | null
          title?: string | null
          uploaded_by?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "asset_media_asset_id_fkey"
            columns: ["asset_id"]
            isOneToOne: false
            referencedRelation: "assets"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "asset_media_structure_id_fkey"
            columns: ["structure_id"]
            isOneToOne: false
            referencedRelation: "structures"
            referencedColumns: ["id"]
          },
        ]
      }
      asset_qr_audit: {
        Row: {
          action: string
          actor_id: string | null
          asset_id: string
          created_at: string
          id: string
          new_token: string | null
          old_token: string | null
          structure_id: string | null
        }
        Insert: {
          action: string
          actor_id?: string | null
          asset_id: string
          created_at?: string
          id?: string
          new_token?: string | null
          old_token?: string | null
          structure_id?: string | null
        }
        Update: {
          action?: string
          actor_id?: string | null
          asset_id?: string
          created_at?: string
          id?: string
          new_token?: string | null
          old_token?: string | null
          structure_id?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "asset_qr_audit_asset_id_fkey"
            columns: ["asset_id"]
            isOneToOne: false
            referencedRelation: "assets"
            referencedColumns: ["id"]
          },
        ]
      }
      asset_scans: {
        Row: {
          asset_id: string
          created_at: string
          id: string
          note: string | null
          scanned_by: string | null
          structure_id: string | null
          user_agent: string | null
        }
        Insert: {
          asset_id: string
          created_at?: string
          id?: string
          note?: string | null
          scanned_by?: string | null
          structure_id?: string | null
          user_agent?: string | null
        }
        Update: {
          asset_id?: string
          created_at?: string
          id?: string
          note?: string | null
          scanned_by?: string | null
          structure_id?: string | null
          user_agent?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "asset_scans_asset_id_fkey"
            columns: ["asset_id"]
            isOneToOne: false
            referencedRelation: "assets"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "asset_scans_structure_id_fkey"
            columns: ["structure_id"]
            isOneToOne: false
            referencedRelation: "structures"
            referencedColumns: ["id"]
          },
        ]
      }
      assets: {
        Row: {
          area: Database["public"]["Enums"]["cost_area"] | null
          brand: string | null
          category_id: string | null
          code: string
          created_at: string
          floor_id: string | null
          id: string
          install_date: string | null
          manual_url: string | null
          model: string | null
          name: string
          notes: string | null
          photo_url: string | null
          qr_generated_at: string | null
          qr_revoked_at: string | null
          qr_token: string | null
          room_id: string | null
          serial_number: string | null
          status: Database["public"]["Enums"]["asset_status"]
          structure_id: string
          updated_at: string
          warranty_until: string | null
        }
        Insert: {
          area?: Database["public"]["Enums"]["cost_area"] | null
          brand?: string | null
          category_id?: string | null
          code: string
          created_at?: string
          floor_id?: string | null
          id?: string
          install_date?: string | null
          manual_url?: string | null
          model?: string | null
          name: string
          notes?: string | null
          photo_url?: string | null
          qr_generated_at?: string | null
          qr_revoked_at?: string | null
          qr_token?: string | null
          room_id?: string | null
          serial_number?: string | null
          status?: Database["public"]["Enums"]["asset_status"]
          structure_id: string
          updated_at?: string
          warranty_until?: string | null
        }
        Update: {
          area?: Database["public"]["Enums"]["cost_area"] | null
          brand?: string | null
          category_id?: string | null
          code?: string
          created_at?: string
          floor_id?: string | null
          id?: string
          install_date?: string | null
          manual_url?: string | null
          model?: string | null
          name?: string
          notes?: string | null
          photo_url?: string | null
          qr_generated_at?: string | null
          qr_revoked_at?: string | null
          qr_token?: string | null
          room_id?: string | null
          serial_number?: string | null
          status?: Database["public"]["Enums"]["asset_status"]
          structure_id?: string
          updated_at?: string
          warranty_until?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "assets_category_id_fkey"
            columns: ["category_id"]
            isOneToOne: false
            referencedRelation: "asset_categories"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "assets_floor_id_fkey"
            columns: ["floor_id"]
            isOneToOne: false
            referencedRelation: "floors"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "assets_room_id_fkey"
            columns: ["room_id"]
            isOneToOne: false
            referencedRelation: "rooms"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "assets_structure_id_fkey"
            columns: ["structure_id"]
            isOneToOne: false
            referencedRelation: "structures"
            referencedColumns: ["id"]
          },
        ]
      }
      audit_log: {
        Row: {
          action: string
          created_at: string
          diff: Json | null
          entity_id: string | null
          entity_type: string
          id: string
          structure_id: string | null
          user_id: string | null
        }
        Insert: {
          action: string
          created_at?: string
          diff?: Json | null
          entity_id?: string | null
          entity_type: string
          id?: string
          structure_id?: string | null
          user_id?: string | null
        }
        Update: {
          action?: string
          created_at?: string
          diff?: Json | null
          entity_id?: string | null
          entity_type?: string
          id?: string
          structure_id?: string | null
          user_id?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "audit_log_structure_id_fkey"
            columns: ["structure_id"]
            isOneToOne: false
            referencedRelation: "structures"
            referencedColumns: ["id"]
          },
        ]
      }
      contracts: {
        Row: {
          amount: number | null
          auto_renew: boolean
          code: string
          created_at: string
          currency: string
          document_url: string | null
          end_date: string | null
          id: string
          notes: string | null
          renewal_months: number | null
          sla_ack_minutes: number | null
          sla_resolve_minutes: number | null
          start_date: string | null
          status: Database["public"]["Enums"]["contract_status"]
          structure_id: string
          supplier_id: string
          title: string
          type: Database["public"]["Enums"]["contract_type"]
          updated_at: string
        }
        Insert: {
          amount?: number | null
          auto_renew?: boolean
          code: string
          created_at?: string
          currency?: string
          document_url?: string | null
          end_date?: string | null
          id?: string
          notes?: string | null
          renewal_months?: number | null
          sla_ack_minutes?: number | null
          sla_resolve_minutes?: number | null
          start_date?: string | null
          status?: Database["public"]["Enums"]["contract_status"]
          structure_id: string
          supplier_id: string
          title: string
          type?: Database["public"]["Enums"]["contract_type"]
          updated_at?: string
        }
        Update: {
          amount?: number | null
          auto_renew?: boolean
          code?: string
          created_at?: string
          currency?: string
          document_url?: string | null
          end_date?: string | null
          id?: string
          notes?: string | null
          renewal_months?: number | null
          sla_ack_minutes?: number | null
          sla_resolve_minutes?: number | null
          start_date?: string | null
          status?: Database["public"]["Enums"]["contract_status"]
          structure_id?: string
          supplier_id?: string
          title?: string
          type?: Database["public"]["Enums"]["contract_type"]
          updated_at?: string
        }
        Relationships: [
          {
            foreignKeyName: "contracts_structure_id_fkey"
            columns: ["structure_id"]
            isOneToOne: false
            referencedRelation: "structures"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "contracts_supplier_id_fkey"
            columns: ["supplier_id"]
            isOneToOne: false
            referencedRelation: "supplier_compliance"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "contracts_supplier_id_fkey"
            columns: ["supplier_id"]
            isOneToOne: false
            referencedRelation: "suppliers"
            referencedColumns: ["id"]
          },
        ]
      }
      conversation_participants: {
        Row: {
          conversation_id: string
          created_at: string
          id: string
          last_read_at: string | null
          supplier_id: string | null
          user_id: string | null
        }
        Insert: {
          conversation_id: string
          created_at?: string
          id?: string
          last_read_at?: string | null
          supplier_id?: string | null
          user_id?: string | null
        }
        Update: {
          conversation_id?: string
          created_at?: string
          id?: string
          last_read_at?: string | null
          supplier_id?: string | null
          user_id?: string | null
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
            foreignKeyName: "conversation_participants_supplier_id_fkey"
            columns: ["supplier_id"]
            isOneToOne: false
            referencedRelation: "supplier_compliance"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "conversation_participants_supplier_id_fkey"
            columns: ["supplier_id"]
            isOneToOne: false
            referencedRelation: "suppliers"
            referencedColumns: ["id"]
          },
        ]
      }
      conversations: {
        Row: {
          agent_type: string | null
          contract_id: string | null
          created_at: string
          created_by: string | null
          id: string
          is_group: boolean
          structure_id: string | null
          ticket_id: string | null
          title: string | null
          updated_at: string
        }
        Insert: {
          agent_type?: string | null
          contract_id?: string | null
          created_at?: string
          created_by?: string | null
          id?: string
          is_group?: boolean
          structure_id?: string | null
          ticket_id?: string | null
          title?: string | null
          updated_at?: string
        }
        Update: {
          agent_type?: string | null
          contract_id?: string | null
          created_at?: string
          created_by?: string | null
          id?: string
          is_group?: boolean
          structure_id?: string | null
          ticket_id?: string | null
          title?: string | null
          updated_at?: string
        }
        Relationships: [
          {
            foreignKeyName: "conversations_contract_id_fkey"
            columns: ["contract_id"]
            isOneToOne: false
            referencedRelation: "contracts"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "conversations_structure_id_fkey"
            columns: ["structure_id"]
            isOneToOne: false
            referencedRelation: "structures"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "conversations_ticket_id_fkey"
            columns: ["ticket_id"]
            isOneToOne: false
            referencedRelation: "tickets"
            referencedColumns: ["id"]
          },
        ]
      }
      cost_centers: {
        Row: {
          area: Database["public"]["Enums"]["cost_area"] | null
          code: string
          created_at: string
          id: string
          name: string
          parent_id: string | null
          structure_id: string
        }
        Insert: {
          area?: Database["public"]["Enums"]["cost_area"] | null
          code: string
          created_at?: string
          id?: string
          name: string
          parent_id?: string | null
          structure_id: string
        }
        Update: {
          area?: Database["public"]["Enums"]["cost_area"] | null
          code?: string
          created_at?: string
          id?: string
          name?: string
          parent_id?: string | null
          structure_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "cost_centers_parent_id_fkey"
            columns: ["parent_id"]
            isOneToOne: false
            referencedRelation: "cost_centers"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "cost_centers_structure_id_fkey"
            columns: ["structure_id"]
            isOneToOne: false
            referencedRelation: "structures"
            referencedColumns: ["id"]
          },
        ]
      }
      dashboard_widgets: {
        Row: {
          config: Json
          created_at: string
          id: string
          position: number
          size: string
          title: string | null
          updated_at: string
          user_id: string
          visible: boolean
          widget_key: string
        }
        Insert: {
          config?: Json
          created_at?: string
          id?: string
          position?: number
          size?: string
          title?: string | null
          updated_at?: string
          user_id: string
          visible?: boolean
          widget_key: string
        }
        Update: {
          config?: Json
          created_at?: string
          id?: string
          position?: number
          size?: string
          title?: string | null
          updated_at?: string
          user_id?: string
          visible?: boolean
          widget_key?: string
        }
        Relationships: []
      }
      delegation_audit: {
        Row: {
          action: string
          actor_id: string | null
          created_at: string
          delegate_id: string | null
          delegation_id: string | null
          delegator_id: string | null
          id: string
          modules: string[] | null
          new_row: Json | null
          old_row: Json | null
          reason: string | null
          structure_id: string | null
        }
        Insert: {
          action: string
          actor_id?: string | null
          created_at?: string
          delegate_id?: string | null
          delegation_id?: string | null
          delegator_id?: string | null
          id?: string
          modules?: string[] | null
          new_row?: Json | null
          old_row?: Json | null
          reason?: string | null
          structure_id?: string | null
        }
        Update: {
          action?: string
          actor_id?: string | null
          created_at?: string
          delegate_id?: string | null
          delegation_id?: string | null
          delegator_id?: string | null
          id?: string
          modules?: string[] | null
          new_row?: Json | null
          old_row?: Json | null
          reason?: string | null
          structure_id?: string | null
        }
        Relationships: []
      }
      floors: {
        Row: {
          created_at: string
          id: string
          level: number | null
          name: string
          structure_id: string
        }
        Insert: {
          created_at?: string
          id?: string
          level?: number | null
          name: string
          structure_id: string
        }
        Update: {
          created_at?: string
          id?: string
          level?: number | null
          name?: string
          structure_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "floors_structure_id_fkey"
            columns: ["structure_id"]
            isOneToOne: false
            referencedRelation: "structures"
            referencedColumns: ["id"]
          },
        ]
      }
      inventory_items: {
        Row: {
          category: string | null
          created_at: string
          id: string
          location: string | null
          min_quantity: number
          name: string
          notes: string | null
          quantity: number
          sku: string
          structure_id: string
          supplier_id: string | null
          unit: string
          unit_cost: number | null
          updated_at: string
        }
        Insert: {
          category?: string | null
          created_at?: string
          id?: string
          location?: string | null
          min_quantity?: number
          name: string
          notes?: string | null
          quantity?: number
          sku: string
          structure_id: string
          supplier_id?: string | null
          unit?: string
          unit_cost?: number | null
          updated_at?: string
        }
        Update: {
          category?: string | null
          created_at?: string
          id?: string
          location?: string | null
          min_quantity?: number
          name?: string
          notes?: string | null
          quantity?: number
          sku?: string
          structure_id?: string
          supplier_id?: string | null
          unit?: string
          unit_cost?: number | null
          updated_at?: string
        }
        Relationships: [
          {
            foreignKeyName: "inventory_items_structure_id_fkey"
            columns: ["structure_id"]
            isOneToOne: false
            referencedRelation: "structures"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "inventory_items_supplier_id_fkey"
            columns: ["supplier_id"]
            isOneToOne: false
            referencedRelation: "supplier_compliance"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "inventory_items_supplier_id_fkey"
            columns: ["supplier_id"]
            isOneToOne: false
            referencedRelation: "suppliers"
            referencedColumns: ["id"]
          },
        ]
      }
      inventory_movements: {
        Row: {
          created_at: string
          id: string
          item_id: string
          movement_type: string
          notes: string | null
          quantity: number
          ticket_id: string | null
          user_id: string | null
          work_order_id: string | null
        }
        Insert: {
          created_at?: string
          id?: string
          item_id: string
          movement_type: string
          notes?: string | null
          quantity: number
          ticket_id?: string | null
          user_id?: string | null
          work_order_id?: string | null
        }
        Update: {
          created_at?: string
          id?: string
          item_id?: string
          movement_type?: string
          notes?: string | null
          quantity?: number
          ticket_id?: string | null
          user_id?: string | null
          work_order_id?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "inventory_movements_item_id_fkey"
            columns: ["item_id"]
            isOneToOne: false
            referencedRelation: "inventory_items"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "inventory_movements_item_id_fkey"
            columns: ["item_id"]
            isOneToOne: false
            referencedRelation: "low_stock_items"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "inventory_movements_ticket_id_fkey"
            columns: ["ticket_id"]
            isOneToOne: false
            referencedRelation: "tickets"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "inventory_movements_work_order_id_fkey"
            columns: ["work_order_id"]
            isOneToOne: false
            referencedRelation: "work_orders"
            referencedColumns: ["id"]
          },
        ]
      }
      invoices: {
        Row: {
          amount_net: number | null
          amount_total: number
          area: Database["public"]["Enums"]["cost_area"] | null
          contract_id: string | null
          cost_center_id: string | null
          created_at: string
          currency: string
          due_date: string | null
          id: string
          issue_date: string
          notes: string | null
          number: string
          ocr_data: Json | null
          paid_at: string | null
          pdf_url: string | null
          status: Database["public"]["Enums"]["invoice_status"]
          structure_id: string
          supplier_id: string | null
          updated_at: string
          utility_type: Database["public"]["Enums"]["utility_type"] | null
          vat: number | null
        }
        Insert: {
          amount_net?: number | null
          amount_total: number
          area?: Database["public"]["Enums"]["cost_area"] | null
          contract_id?: string | null
          cost_center_id?: string | null
          created_at?: string
          currency?: string
          due_date?: string | null
          id?: string
          issue_date: string
          notes?: string | null
          number: string
          ocr_data?: Json | null
          paid_at?: string | null
          pdf_url?: string | null
          status?: Database["public"]["Enums"]["invoice_status"]
          structure_id: string
          supplier_id?: string | null
          updated_at?: string
          utility_type?: Database["public"]["Enums"]["utility_type"] | null
          vat?: number | null
        }
        Update: {
          amount_net?: number | null
          amount_total?: number
          area?: Database["public"]["Enums"]["cost_area"] | null
          contract_id?: string | null
          cost_center_id?: string | null
          created_at?: string
          currency?: string
          due_date?: string | null
          id?: string
          issue_date?: string
          notes?: string | null
          number?: string
          ocr_data?: Json | null
          paid_at?: string | null
          pdf_url?: string | null
          status?: Database["public"]["Enums"]["invoice_status"]
          structure_id?: string
          supplier_id?: string | null
          updated_at?: string
          utility_type?: Database["public"]["Enums"]["utility_type"] | null
          vat?: number | null
        }
        Relationships: [
          {
            foreignKeyName: "invoices_contract_id_fkey"
            columns: ["contract_id"]
            isOneToOne: false
            referencedRelation: "contracts"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "invoices_cost_center_id_fkey"
            columns: ["cost_center_id"]
            isOneToOne: false
            referencedRelation: "cost_centers"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "invoices_structure_id_fkey"
            columns: ["structure_id"]
            isOneToOne: false
            referencedRelation: "structures"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "invoices_supplier_id_fkey"
            columns: ["supplier_id"]
            isOneToOne: false
            referencedRelation: "supplier_compliance"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "invoices_supplier_id_fkey"
            columns: ["supplier_id"]
            isOneToOne: false
            referencedRelation: "suppliers"
            referencedColumns: ["id"]
          },
        ]
      }
      maintenance_plans: {
        Row: {
          active: boolean
          asset_id: string | null
          assigned_to: string | null
          category_id: string | null
          checklist: Json
          created_at: string
          description: string | null
          frequency: Database["public"]["Enums"]["maintenance_frequency"]
          id: string
          interval_days: number | null
          name: string
          next_due: string | null
          structure_id: string
          supplier_id: string | null
          updated_at: string
        }
        Insert: {
          active?: boolean
          asset_id?: string | null
          assigned_to?: string | null
          category_id?: string | null
          checklist?: Json
          created_at?: string
          description?: string | null
          frequency?: Database["public"]["Enums"]["maintenance_frequency"]
          id?: string
          interval_days?: number | null
          name: string
          next_due?: string | null
          structure_id: string
          supplier_id?: string | null
          updated_at?: string
        }
        Update: {
          active?: boolean
          asset_id?: string | null
          assigned_to?: string | null
          category_id?: string | null
          checklist?: Json
          created_at?: string
          description?: string | null
          frequency?: Database["public"]["Enums"]["maintenance_frequency"]
          id?: string
          interval_days?: number | null
          name?: string
          next_due?: string | null
          structure_id?: string
          supplier_id?: string | null
          updated_at?: string
        }
        Relationships: [
          {
            foreignKeyName: "maintenance_plans_asset_id_fkey"
            columns: ["asset_id"]
            isOneToOne: false
            referencedRelation: "assets"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "maintenance_plans_category_id_fkey"
            columns: ["category_id"]
            isOneToOne: false
            referencedRelation: "asset_categories"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "maintenance_plans_structure_id_fkey"
            columns: ["structure_id"]
            isOneToOne: false
            referencedRelation: "structures"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "maintenance_plans_supplier_id_fkey"
            columns: ["supplier_id"]
            isOneToOne: false
            referencedRelation: "supplier_compliance"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "maintenance_plans_supplier_id_fkey"
            columns: ["supplier_id"]
            isOneToOne: false
            referencedRelation: "suppliers"
            referencedColumns: ["id"]
          },
        ]
      }
      maintenance_tasks: {
        Row: {
          actual_hours: number | null
          assigned_to: string | null
          checklist_result: Json | null
          completed_at: string | null
          completed_by: string | null
          created_at: string
          due_date: string
          estimated_hours: number | null
          id: string
          notes: string | null
          outcome: string | null
          photos: Json
          plan_id: string
          scheduled_for: string | null
          signature_url: string | null
          signed_at: string | null
          status: string
          ticket_report_id: string | null
          updated_at: string
        }
        Insert: {
          actual_hours?: number | null
          assigned_to?: string | null
          checklist_result?: Json | null
          completed_at?: string | null
          completed_by?: string | null
          created_at?: string
          due_date: string
          estimated_hours?: number | null
          id?: string
          notes?: string | null
          outcome?: string | null
          photos?: Json
          plan_id: string
          scheduled_for?: string | null
          signature_url?: string | null
          signed_at?: string | null
          status?: string
          ticket_report_id?: string | null
          updated_at?: string
        }
        Update: {
          actual_hours?: number | null
          assigned_to?: string | null
          checklist_result?: Json | null
          completed_at?: string | null
          completed_by?: string | null
          created_at?: string
          due_date?: string
          estimated_hours?: number | null
          id?: string
          notes?: string | null
          outcome?: string | null
          photos?: Json
          plan_id?: string
          scheduled_for?: string | null
          signature_url?: string | null
          signed_at?: string | null
          status?: string
          ticket_report_id?: string | null
          updated_at?: string
        }
        Relationships: [
          {
            foreignKeyName: "maintenance_tasks_plan_id_fkey"
            columns: ["plan_id"]
            isOneToOne: false
            referencedRelation: "maintenance_plans"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "maintenance_tasks_ticket_report_id_fkey"
            columns: ["ticket_report_id"]
            isOneToOne: false
            referencedRelation: "ticket_reports"
            referencedColumns: ["id"]
          },
        ]
      }
      messages: {
        Row: {
          agent_meta: Json | null
          attachments: Json | null
          body: string
          conversation_id: string
          created_at: string
          id: string
          sender_id: string | null
          sender_kind: string
        }
        Insert: {
          agent_meta?: Json | null
          attachments?: Json | null
          body: string
          conversation_id: string
          created_at?: string
          id?: string
          sender_id?: string | null
          sender_kind?: string
        }
        Update: {
          agent_meta?: Json | null
          attachments?: Json | null
          body?: string
          conversation_id?: string
          created_at?: string
          id?: string
          sender_id?: string | null
          sender_kind?: string
        }
        Relationships: [
          {
            foreignKeyName: "messages_conversation_id_fkey"
            columns: ["conversation_id"]
            isOneToOne: false
            referencedRelation: "conversations"
            referencedColumns: ["id"]
          },
        ]
      }
      meter_readings: {
        Row: {
          created_at: string
          id: string
          meter_id: string
          notes: string | null
          reading_date: string
          user_id: string | null
          value: number
        }
        Insert: {
          created_at?: string
          id?: string
          meter_id: string
          notes?: string | null
          reading_date: string
          user_id?: string | null
          value: number
        }
        Update: {
          created_at?: string
          id?: string
          meter_id?: string
          notes?: string | null
          reading_date?: string
          user_id?: string | null
          value?: number
        }
        Relationships: [
          {
            foreignKeyName: "meter_readings_meter_id_fkey"
            columns: ["meter_id"]
            isOneToOne: false
            referencedRelation: "utility_meters"
            referencedColumns: ["id"]
          },
        ]
      }
      module_permissions: {
        Row: {
          action: string
          allowed: boolean
          created_at: string
          id: string
          module: string
          role: Database["public"]["Enums"]["app_role"] | null
          structure_id: string | null
          user_id: string | null
        }
        Insert: {
          action?: string
          allowed?: boolean
          created_at?: string
          id?: string
          module: string
          role?: Database["public"]["Enums"]["app_role"] | null
          structure_id?: string | null
          user_id?: string | null
        }
        Update: {
          action?: string
          allowed?: boolean
          created_at?: string
          id?: string
          module?: string
          role?: Database["public"]["Enums"]["app_role"] | null
          structure_id?: string | null
          user_id?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "module_permissions_structure_id_fkey"
            columns: ["structure_id"]
            isOneToOne: false
            referencedRelation: "structures"
            referencedColumns: ["id"]
          },
        ]
      }
      notification_channels: {
        Row: {
          active: boolean
          created_at: string
          created_by: string | null
          events: Database["public"]["Enums"]["notification_event"][]
          id: string
          name: string
          structure_id: string | null
          target: string
          type: Database["public"]["Enums"]["notification_channel_type"]
          updated_at: string
        }
        Insert: {
          active?: boolean
          created_at?: string
          created_by?: string | null
          events?: Database["public"]["Enums"]["notification_event"][]
          id?: string
          name: string
          structure_id?: string | null
          target: string
          type: Database["public"]["Enums"]["notification_channel_type"]
          updated_at?: string
        }
        Update: {
          active?: boolean
          created_at?: string
          created_by?: string | null
          events?: Database["public"]["Enums"]["notification_event"][]
          id?: string
          name?: string
          structure_id?: string | null
          target?: string
          type?: Database["public"]["Enums"]["notification_channel_type"]
          updated_at?: string
        }
        Relationships: [
          {
            foreignKeyName: "notification_channels_structure_id_fkey"
            columns: ["structure_id"]
            isOneToOne: false
            referencedRelation: "structures"
            referencedColumns: ["id"]
          },
        ]
      }
      notification_log: {
        Row: {
          channel_id: string | null
          channel_type: Database["public"]["Enums"]["notification_channel_type"]
          created_at: string
          error: string | null
          event: Database["public"]["Enums"]["notification_event"]
          id: string
          payload: Json
          status: string
          structure_id: string | null
          subject: string | null
          target: string
        }
        Insert: {
          channel_id?: string | null
          channel_type: Database["public"]["Enums"]["notification_channel_type"]
          created_at?: string
          error?: string | null
          event: Database["public"]["Enums"]["notification_event"]
          id?: string
          payload?: Json
          status?: string
          structure_id?: string | null
          subject?: string | null
          target: string
        }
        Update: {
          channel_id?: string | null
          channel_type?: Database["public"]["Enums"]["notification_channel_type"]
          created_at?: string
          error?: string | null
          event?: Database["public"]["Enums"]["notification_event"]
          id?: string
          payload?: Json
          status?: string
          structure_id?: string | null
          subject?: string | null
          target?: string
        }
        Relationships: [
          {
            foreignKeyName: "notification_log_channel_id_fkey"
            columns: ["channel_id"]
            isOneToOne: false
            referencedRelation: "notification_channels"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "notification_log_structure_id_fkey"
            columns: ["structure_id"]
            isOneToOne: false
            referencedRelation: "structures"
            referencedColumns: ["id"]
          },
        ]
      }
      penalty_rules: {
        Row: {
          active: boolean
          amount_eur: number
          amount_pct: number | null
          contract_id: string | null
          created_at: string
          id: string
          name: string
          per_hour: boolean
          structure_id: string | null
          supplier_id: string | null
          threshold_minutes: number | null
          trigger_type: string
        }
        Insert: {
          active?: boolean
          amount_eur?: number
          amount_pct?: number | null
          contract_id?: string | null
          created_at?: string
          id?: string
          name: string
          per_hour?: boolean
          structure_id?: string | null
          supplier_id?: string | null
          threshold_minutes?: number | null
          trigger_type?: string
        }
        Update: {
          active?: boolean
          amount_eur?: number
          amount_pct?: number | null
          contract_id?: string | null
          created_at?: string
          id?: string
          name?: string
          per_hour?: boolean
          structure_id?: string | null
          supplier_id?: string | null
          threshold_minutes?: number | null
          trigger_type?: string
        }
        Relationships: [
          {
            foreignKeyName: "penalty_rules_contract_id_fkey"
            columns: ["contract_id"]
            isOneToOne: false
            referencedRelation: "contracts"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "penalty_rules_structure_id_fkey"
            columns: ["structure_id"]
            isOneToOne: false
            referencedRelation: "structures"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "penalty_rules_supplier_id_fkey"
            columns: ["supplier_id"]
            isOneToOne: false
            referencedRelation: "supplier_compliance"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "penalty_rules_supplier_id_fkey"
            columns: ["supplier_id"]
            isOneToOne: false
            referencedRelation: "suppliers"
            referencedColumns: ["id"]
          },
        ]
      }
      profiles: {
        Row: {
          avatar_url: string | null
          created_at: string
          email: string
          full_name: string | null
          id: string
          phone: string | null
          updated_at: string
        }
        Insert: {
          avatar_url?: string | null
          created_at?: string
          email: string
          full_name?: string | null
          id: string
          phone?: string | null
          updated_at?: string
        }
        Update: {
          avatar_url?: string | null
          created_at?: string
          email?: string
          full_name?: string | null
          id?: string
          phone?: string | null
          updated_at?: string
        }
        Relationships: []
      }
      purchase_orders: {
        Row: {
          area: Database["public"]["Enums"]["cost_area"] | null
          created_at: string
          created_by: string | null
          expected_delivery: string | null
          id: string
          items: Json
          notes: string | null
          number: string | null
          order_date: string
          status: string
          structure_id: string
          supplier_id: string | null
          total: number | null
          updated_at: string
        }
        Insert: {
          area?: Database["public"]["Enums"]["cost_area"] | null
          created_at?: string
          created_by?: string | null
          expected_delivery?: string | null
          id?: string
          items?: Json
          notes?: string | null
          number?: string | null
          order_date?: string
          status?: string
          structure_id: string
          supplier_id?: string | null
          total?: number | null
          updated_at?: string
        }
        Update: {
          area?: Database["public"]["Enums"]["cost_area"] | null
          created_at?: string
          created_by?: string | null
          expected_delivery?: string | null
          id?: string
          items?: Json
          notes?: string | null
          number?: string | null
          order_date?: string
          status?: string
          structure_id?: string
          supplier_id?: string | null
          total?: number | null
          updated_at?: string
        }
        Relationships: [
          {
            foreignKeyName: "purchase_orders_structure_id_fkey"
            columns: ["structure_id"]
            isOneToOne: false
            referencedRelation: "structures"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "purchase_orders_supplier_id_fkey"
            columns: ["supplier_id"]
            isOneToOne: false
            referencedRelation: "supplier_compliance"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "purchase_orders_supplier_id_fkey"
            columns: ["supplier_id"]
            isOneToOne: false
            referencedRelation: "suppliers"
            referencedColumns: ["id"]
          },
        ]
      }
      reorder_attachments: {
        Row: {
          created_at: string
          file_name: string | null
          file_path: string
          id: string
          kind: string
          mime_type: string | null
          reorder_id: string
          structure_id: string
          uploaded_by: string | null
        }
        Insert: {
          created_at?: string
          file_name?: string | null
          file_path: string
          id?: string
          kind: string
          mime_type?: string | null
          reorder_id: string
          structure_id: string
          uploaded_by?: string | null
        }
        Update: {
          created_at?: string
          file_name?: string | null
          file_path?: string
          id?: string
          kind?: string
          mime_type?: string | null
          reorder_id?: string
          structure_id?: string
          uploaded_by?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "reorder_attachments_reorder_id_fkey"
            columns: ["reorder_id"]
            isOneToOne: false
            referencedRelation: "reorder_requests"
            referencedColumns: ["id"]
          },
        ]
      }
      reorder_events: {
        Row: {
          actor_id: string | null
          created_at: string
          from_status: Database["public"]["Enums"]["reorder_status"] | null
          id: string
          note: string | null
          reorder_id: string
          to_status: Database["public"]["Enums"]["reorder_status"]
        }
        Insert: {
          actor_id?: string | null
          created_at?: string
          from_status?: Database["public"]["Enums"]["reorder_status"] | null
          id?: string
          note?: string | null
          reorder_id: string
          to_status: Database["public"]["Enums"]["reorder_status"]
        }
        Update: {
          actor_id?: string | null
          created_at?: string
          from_status?: Database["public"]["Enums"]["reorder_status"] | null
          id?: string
          note?: string | null
          reorder_id?: string
          to_status?: Database["public"]["Enums"]["reorder_status"]
        }
        Relationships: [
          {
            foreignKeyName: "reorder_events_reorder_id_fkey"
            columns: ["reorder_id"]
            isOneToOne: false
            referencedRelation: "reorder_requests"
            referencedColumns: ["id"]
          },
        ]
      }
      reorder_requests: {
        Row: {
          created_at: string
          created_by: string | null
          id: string
          item_id: string
          notes: string | null
          quantity: number
          status: Database["public"]["Enums"]["reorder_status"]
          structure_id: string
          supplier_id: string | null
          updated_at: string
        }
        Insert: {
          created_at?: string
          created_by?: string | null
          id?: string
          item_id: string
          notes?: string | null
          quantity: number
          status?: Database["public"]["Enums"]["reorder_status"]
          structure_id: string
          supplier_id?: string | null
          updated_at?: string
        }
        Update: {
          created_at?: string
          created_by?: string | null
          id?: string
          item_id?: string
          notes?: string | null
          quantity?: number
          status?: Database["public"]["Enums"]["reorder_status"]
          structure_id?: string
          supplier_id?: string | null
          updated_at?: string
        }
        Relationships: [
          {
            foreignKeyName: "reorder_requests_item_id_fkey"
            columns: ["item_id"]
            isOneToOne: false
            referencedRelation: "inventory_items"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "reorder_requests_item_id_fkey"
            columns: ["item_id"]
            isOneToOne: false
            referencedRelation: "low_stock_items"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "reorder_requests_structure_id_fkey"
            columns: ["structure_id"]
            isOneToOne: false
            referencedRelation: "structures"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "reorder_requests_supplier_id_fkey"
            columns: ["supplier_id"]
            isOneToOne: false
            referencedRelation: "supplier_compliance"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "reorder_requests_supplier_id_fkey"
            columns: ["supplier_id"]
            isOneToOne: false
            referencedRelation: "suppliers"
            referencedColumns: ["id"]
          },
        ]
      }
      report_delivery_queue: {
        Row: {
          attempts: number
          created_at: string
          id: string
          last_error: string | null
          max_attempts: number
          next_attempt_at: string
          payload: Json
          recipient: string
          run_id: string | null
          status: string
          structure_id: string | null
          subject: string | null
          template_id: string | null
          updated_at: string
        }
        Insert: {
          attempts?: number
          created_at?: string
          id?: string
          last_error?: string | null
          max_attempts?: number
          next_attempt_at?: string
          payload?: Json
          recipient: string
          run_id?: string | null
          status?: string
          structure_id?: string | null
          subject?: string | null
          template_id?: string | null
          updated_at?: string
        }
        Update: {
          attempts?: number
          created_at?: string
          id?: string
          last_error?: string | null
          max_attempts?: number
          next_attempt_at?: string
          payload?: Json
          recipient?: string
          run_id?: string | null
          status?: string
          structure_id?: string | null
          subject?: string | null
          template_id?: string | null
          updated_at?: string
        }
        Relationships: [
          {
            foreignKeyName: "report_delivery_queue_run_id_fkey"
            columns: ["run_id"]
            isOneToOne: false
            referencedRelation: "scheduled_report_runs"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "report_delivery_queue_structure_id_fkey"
            columns: ["structure_id"]
            isOneToOne: false
            referencedRelation: "structures"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "report_delivery_queue_template_id_fkey"
            columns: ["template_id"]
            isOneToOne: false
            referencedRelation: "report_templates"
            referencedColumns: ["id"]
          },
        ]
      }
      report_pdf_previews: {
        Row: {
          created_at: string
          expires_at: string
          id: string
          owner_id: string
          path: string
          recipient: string | null
          size_bytes: number | null
          template_id: string | null
          template_name: string | null
        }
        Insert: {
          created_at?: string
          expires_at?: string
          id?: string
          owner_id: string
          path: string
          recipient?: string | null
          size_bytes?: number | null
          template_id?: string | null
          template_name?: string | null
        }
        Update: {
          created_at?: string
          expires_at?: string
          id?: string
          owner_id?: string
          path?: string
          recipient?: string | null
          size_bytes?: number | null
          template_id?: string | null
          template_name?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "report_pdf_previews_template_id_fkey"
            columns: ["template_id"]
            isOneToOne: false
            referencedRelation: "report_templates"
            referencedColumns: ["id"]
          },
        ]
      }
      report_template_access: {
        Row: {
          created_at: string
          granted_by: string | null
          id: string
          permission: string
          role: Database["public"]["Enums"]["app_role"] | null
          template_id: string
          user_id: string | null
        }
        Insert: {
          created_at?: string
          granted_by?: string | null
          id?: string
          permission?: string
          role?: Database["public"]["Enums"]["app_role"] | null
          template_id: string
          user_id?: string | null
        }
        Update: {
          created_at?: string
          granted_by?: string | null
          id?: string
          permission?: string
          role?: Database["public"]["Enums"]["app_role"] | null
          template_id?: string
          user_id?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "report_template_access_template_id_fkey"
            columns: ["template_id"]
            isOneToOne: false
            referencedRelation: "report_templates"
            referencedColumns: ["id"]
          },
        ]
      }
      report_template_layout_audit: {
        Row: {
          actor_id: string | null
          created_at: string
          field: string
          id: string
          new_value: Json | null
          old_value: Json | null
          recipient: string | null
          template_id: string
        }
        Insert: {
          actor_id?: string | null
          created_at?: string
          field: string
          id?: string
          new_value?: Json | null
          old_value?: Json | null
          recipient?: string | null
          template_id: string
        }
        Update: {
          actor_id?: string | null
          created_at?: string
          field?: string
          id?: string
          new_value?: Json | null
          old_value?: Json | null
          recipient?: string | null
          template_id?: string
        }
        Relationships: []
      }
      report_templates: {
        Row: {
          columns: Json
          created_at: string
          description: string | null
          filters: Json
          group_by: string | null
          id: string
          is_shared: boolean
          last_export_url: string | null
          last_run_at: string | null
          layout: Json
          max_retries: number
          name: string
          next_run_at: string | null
          owner_id: string | null
          pdf_layout: Json | null
          recipient_layouts: Json
          recipients: string[]
          retry_backoff_minutes: number
          schedule_cron: string | null
          source: string
          structure_id: string | null
          timezone: string | null
          updated_at: string
        }
        Insert: {
          columns?: Json
          created_at?: string
          description?: string | null
          filters?: Json
          group_by?: string | null
          id?: string
          is_shared?: boolean
          last_export_url?: string | null
          last_run_at?: string | null
          layout?: Json
          max_retries?: number
          name: string
          next_run_at?: string | null
          owner_id?: string | null
          pdf_layout?: Json | null
          recipient_layouts?: Json
          recipients?: string[]
          retry_backoff_minutes?: number
          schedule_cron?: string | null
          source: string
          structure_id?: string | null
          timezone?: string | null
          updated_at?: string
        }
        Update: {
          columns?: Json
          created_at?: string
          description?: string | null
          filters?: Json
          group_by?: string | null
          id?: string
          is_shared?: boolean
          last_export_url?: string | null
          last_run_at?: string | null
          layout?: Json
          max_retries?: number
          name?: string
          next_run_at?: string | null
          owner_id?: string | null
          pdf_layout?: Json | null
          recipient_layouts?: Json
          recipients?: string[]
          retry_backoff_minutes?: number
          schedule_cron?: string | null
          source?: string
          structure_id?: string | null
          timezone?: string | null
          updated_at?: string
        }
        Relationships: [
          {
            foreignKeyName: "report_templates_structure_id_fkey"
            columns: ["structure_id"]
            isOneToOne: false
            referencedRelation: "structures"
            referencedColumns: ["id"]
          },
        ]
      }
      rooms: {
        Row: {
          created_at: string
          floor_id: string | null
          id: string
          name: string
          room_type: string | null
          structure_id: string
        }
        Insert: {
          created_at?: string
          floor_id?: string | null
          id?: string
          name: string
          room_type?: string | null
          structure_id: string
        }
        Update: {
          created_at?: string
          floor_id?: string | null
          id?: string
          name?: string
          room_type?: string | null
          structure_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "rooms_floor_id_fkey"
            columns: ["floor_id"]
            isOneToOne: false
            referencedRelation: "floors"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "rooms_structure_id_fkey"
            columns: ["structure_id"]
            isOneToOne: false
            referencedRelation: "structures"
            referencedColumns: ["id"]
          },
        ]
      }
      scheduled_report_runs: {
        Row: {
          attempts: number
          error: string | null
          finished_at: string | null
          id: string
          last_error_at: string | null
          next_retry_at: string | null
          recipient_logs: Json
          recipients: string[]
          rows_count: number | null
          started_at: string
          status: string
          structure_id: string | null
          template_id: string
          triggered_by: string
        }
        Insert: {
          attempts?: number
          error?: string | null
          finished_at?: string | null
          id?: string
          last_error_at?: string | null
          next_retry_at?: string | null
          recipient_logs?: Json
          recipients?: string[]
          rows_count?: number | null
          started_at?: string
          status?: string
          structure_id?: string | null
          template_id: string
          triggered_by?: string
        }
        Update: {
          attempts?: number
          error?: string | null
          finished_at?: string | null
          id?: string
          last_error_at?: string | null
          next_retry_at?: string | null
          recipient_logs?: Json
          recipients?: string[]
          rows_count?: number | null
          started_at?: string
          status?: string
          structure_id?: string | null
          template_id?: string
          triggered_by?: string
        }
        Relationships: [
          {
            foreignKeyName: "scheduled_report_runs_template_id_fkey"
            columns: ["template_id"]
            isOneToOne: false
            referencedRelation: "report_templates"
            referencedColumns: ["id"]
          },
        ]
      }
      sla_notifications: {
        Row: {
          acknowledged_at: string | null
          acknowledged_by: string | null
          channel: string
          created_at: string
          delay_minutes: number | null
          due_at: string | null
          id: string
          kind: string
          payload: Json
          structure_id: string | null
          ticket_id: string
        }
        Insert: {
          acknowledged_at?: string | null
          acknowledged_by?: string | null
          channel?: string
          created_at?: string
          delay_minutes?: number | null
          due_at?: string | null
          id?: string
          kind: string
          payload?: Json
          structure_id?: string | null
          ticket_id: string
        }
        Update: {
          acknowledged_at?: string | null
          acknowledged_by?: string | null
          channel?: string
          created_at?: string
          delay_minutes?: number | null
          due_at?: string | null
          id?: string
          kind?: string
          payload?: Json
          structure_id?: string | null
          ticket_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "sla_notifications_structure_id_fkey"
            columns: ["structure_id"]
            isOneToOne: false
            referencedRelation: "structures"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "sla_notifications_ticket_id_fkey"
            columns: ["ticket_id"]
            isOneToOne: false
            referencedRelation: "tickets"
            referencedColumns: ["id"]
          },
        ]
      }
      sla_rules: {
        Row: {
          ack_minutes: number
          area: Database["public"]["Enums"]["cost_area"] | null
          category_id: string | null
          created_at: string
          description: string | null
          enabled: boolean
          id: string
          name: string | null
          priority: Database["public"]["Enums"]["ticket_priority"]
          resolve_minutes: number
          structure_id: string | null
        }
        Insert: {
          ack_minutes: number
          area?: Database["public"]["Enums"]["cost_area"] | null
          category_id?: string | null
          created_at?: string
          description?: string | null
          enabled?: boolean
          id?: string
          name?: string | null
          priority: Database["public"]["Enums"]["ticket_priority"]
          resolve_minutes: number
          structure_id?: string | null
        }
        Update: {
          ack_minutes?: number
          area?: Database["public"]["Enums"]["cost_area"] | null
          category_id?: string | null
          created_at?: string
          description?: string | null
          enabled?: boolean
          id?: string
          name?: string | null
          priority?: Database["public"]["Enums"]["ticket_priority"]
          resolve_minutes?: number
          structure_id?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "sla_rules_category_id_fkey"
            columns: ["category_id"]
            isOneToOne: false
            referencedRelation: "asset_categories"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "sla_rules_structure_id_fkey"
            columns: ["structure_id"]
            isOneToOne: false
            referencedRelation: "structures"
            referencedColumns: ["id"]
          },
        ]
      }
      sla_violations: {
        Row: {
          created_at: string
          delay_minutes: number
          id: string
          kind: string
          notes: string | null
          penalty_eur: number
          rule_id: string | null
          status: string
          structure_id: string | null
          supplier_id: string | null
          ticket_id: string
        }
        Insert: {
          created_at?: string
          delay_minutes?: number
          id?: string
          kind: string
          notes?: string | null
          penalty_eur?: number
          rule_id?: string | null
          status?: string
          structure_id?: string | null
          supplier_id?: string | null
          ticket_id: string
        }
        Update: {
          created_at?: string
          delay_minutes?: number
          id?: string
          kind?: string
          notes?: string | null
          penalty_eur?: number
          rule_id?: string | null
          status?: string
          structure_id?: string | null
          supplier_id?: string | null
          ticket_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "sla_violations_rule_id_fkey"
            columns: ["rule_id"]
            isOneToOne: false
            referencedRelation: "penalty_rules"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "sla_violations_structure_id_fkey"
            columns: ["structure_id"]
            isOneToOne: false
            referencedRelation: "structures"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "sla_violations_supplier_id_fkey"
            columns: ["supplier_id"]
            isOneToOne: false
            referencedRelation: "supplier_compliance"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "sla_violations_supplier_id_fkey"
            columns: ["supplier_id"]
            isOneToOne: false
            referencedRelation: "suppliers"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "sla_violations_ticket_id_fkey"
            columns: ["ticket_id"]
            isOneToOne: false
            referencedRelation: "tickets"
            referencedColumns: ["id"]
          },
        ]
      }
      structures: {
        Row: {
          address: string | null
          city: string | null
          code: string | null
          country: string | null
          created_at: string
          id: string
          name: string
          notes: string | null
          rooms_count: number | null
          timezone: string
          updated_at: string
        }
        Insert: {
          address?: string | null
          city?: string | null
          code?: string | null
          country?: string | null
          created_at?: string
          id?: string
          name: string
          notes?: string | null
          rooms_count?: number | null
          timezone?: string
          updated_at?: string
        }
        Update: {
          address?: string | null
          city?: string | null
          code?: string | null
          country?: string | null
          created_at?: string
          id?: string
          name?: string
          notes?: string | null
          rooms_count?: number | null
          timezone?: string
          updated_at?: string
        }
        Relationships: []
      }
      suppliers: {
        Row: {
          address: string | null
          blocked: boolean
          category: string | null
          certifications: Json
          contact_person: string | null
          created_at: string
          durc_expiry: string | null
          email: string | null
          haccp_expiry: string | null
          id: string
          insurance_expiry: string | null
          name: string
          notes: string | null
          phone: string | null
          rating: number | null
          status: Database["public"]["Enums"]["supplier_status"]
          structure_id: string | null
          updated_at: string
          vat_number: string | null
          visura_expiry: string | null
        }
        Insert: {
          address?: string | null
          blocked?: boolean
          category?: string | null
          certifications?: Json
          contact_person?: string | null
          created_at?: string
          durc_expiry?: string | null
          email?: string | null
          haccp_expiry?: string | null
          id?: string
          insurance_expiry?: string | null
          name: string
          notes?: string | null
          phone?: string | null
          rating?: number | null
          status?: Database["public"]["Enums"]["supplier_status"]
          structure_id?: string | null
          updated_at?: string
          vat_number?: string | null
          visura_expiry?: string | null
        }
        Update: {
          address?: string | null
          blocked?: boolean
          category?: string | null
          certifications?: Json
          contact_person?: string | null
          created_at?: string
          durc_expiry?: string | null
          email?: string | null
          haccp_expiry?: string | null
          id?: string
          insurance_expiry?: string | null
          name?: string
          notes?: string | null
          phone?: string | null
          rating?: number | null
          status?: Database["public"]["Enums"]["supplier_status"]
          structure_id?: string | null
          updated_at?: string
          vat_number?: string | null
          visura_expiry?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "suppliers_structure_id_fkey"
            columns: ["structure_id"]
            isOneToOne: false
            referencedRelation: "structures"
            referencedColumns: ["id"]
          },
        ]
      }
      ticket_attachments: {
        Row: {
          caption: string | null
          created_at: string
          file_name: string | null
          id: string
          kind: string
          mime_type: string | null
          size_bytes: number | null
          storage_path: string
          ticket_id: string
          uploaded_by: string | null
        }
        Insert: {
          caption?: string | null
          created_at?: string
          file_name?: string | null
          id?: string
          kind?: string
          mime_type?: string | null
          size_bytes?: number | null
          storage_path: string
          ticket_id: string
          uploaded_by?: string | null
        }
        Update: {
          caption?: string | null
          created_at?: string
          file_name?: string | null
          id?: string
          kind?: string
          mime_type?: string | null
          size_bytes?: number | null
          storage_path?: string
          ticket_id?: string
          uploaded_by?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "ticket_attachments_ticket_id_fkey"
            columns: ["ticket_id"]
            isOneToOne: false
            referencedRelation: "tickets"
            referencedColumns: ["id"]
          },
        ]
      }
      ticket_comments: {
        Row: {
          author_id: string | null
          body: string
          created_at: string
          id: string
          ticket_id: string
        }
        Insert: {
          author_id?: string | null
          body: string
          created_at?: string
          id?: string
          ticket_id: string
        }
        Update: {
          author_id?: string | null
          body?: string
          created_at?: string
          id?: string
          ticket_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "ticket_comments_ticket_id_fkey"
            columns: ["ticket_id"]
            isOneToOne: false
            referencedRelation: "tickets"
            referencedColumns: ["id"]
          },
        ]
      }
      ticket_reports: {
        Row: {
          author_id: string | null
          created_at: string
          hours_worked: number | null
          id: string
          materials_used: Json | null
          signature_data_url: string | null
          signed_at: string | null
          summary: string
          ticket_id: string
        }
        Insert: {
          author_id?: string | null
          created_at?: string
          hours_worked?: number | null
          id?: string
          materials_used?: Json | null
          signature_data_url?: string | null
          signed_at?: string | null
          summary: string
          ticket_id: string
        }
        Update: {
          author_id?: string | null
          created_at?: string
          hours_worked?: number | null
          id?: string
          materials_used?: Json | null
          signature_data_url?: string | null
          signed_at?: string | null
          summary?: string
          ticket_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "ticket_reports_ticket_id_fkey"
            columns: ["ticket_id"]
            isOneToOne: false
            referencedRelation: "tickets"
            referencedColumns: ["id"]
          },
        ]
      }
      tickets: {
        Row: {
          ack_at: string | null
          ack_due_at: string | null
          area: Database["public"]["Enums"]["cost_area"] | null
          asset_id: string | null
          assigned_to: string | null
          category_id: string | null
          closed_at: string | null
          created_at: string
          description: string | null
          id: string
          photo_url: string | null
          priority: Database["public"]["Enums"]["ticket_priority"]
          reported_by: string | null
          resolve_due_at: string | null
          resolved_at: string | null
          room_id: string | null
          status: Database["public"]["Enums"]["ticket_status"]
          structure_id: string
          ticket_number: number
          title: string
          tts_announced: boolean
          updated_at: string
        }
        Insert: {
          ack_at?: string | null
          ack_due_at?: string | null
          area?: Database["public"]["Enums"]["cost_area"] | null
          asset_id?: string | null
          assigned_to?: string | null
          category_id?: string | null
          closed_at?: string | null
          created_at?: string
          description?: string | null
          id?: string
          photo_url?: string | null
          priority?: Database["public"]["Enums"]["ticket_priority"]
          reported_by?: string | null
          resolve_due_at?: string | null
          resolved_at?: string | null
          room_id?: string | null
          status?: Database["public"]["Enums"]["ticket_status"]
          structure_id: string
          ticket_number?: number
          title: string
          tts_announced?: boolean
          updated_at?: string
        }
        Update: {
          ack_at?: string | null
          ack_due_at?: string | null
          area?: Database["public"]["Enums"]["cost_area"] | null
          asset_id?: string | null
          assigned_to?: string | null
          category_id?: string | null
          closed_at?: string | null
          created_at?: string
          description?: string | null
          id?: string
          photo_url?: string | null
          priority?: Database["public"]["Enums"]["ticket_priority"]
          reported_by?: string | null
          resolve_due_at?: string | null
          resolved_at?: string | null
          room_id?: string | null
          status?: Database["public"]["Enums"]["ticket_status"]
          structure_id?: string
          ticket_number?: number
          title?: string
          tts_announced?: boolean
          updated_at?: string
        }
        Relationships: [
          {
            foreignKeyName: "tickets_asset_id_fkey"
            columns: ["asset_id"]
            isOneToOne: false
            referencedRelation: "assets"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "tickets_category_id_fkey"
            columns: ["category_id"]
            isOneToOne: false
            referencedRelation: "asset_categories"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "tickets_room_id_fkey"
            columns: ["room_id"]
            isOneToOne: false
            referencedRelation: "rooms"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "tickets_structure_id_fkey"
            columns: ["structure_id"]
            isOneToOne: false
            referencedRelation: "structures"
            referencedColumns: ["id"]
          },
        ]
      }
      user_delegations: {
        Row: {
          active: boolean
          created_at: string
          delegate_id: string
          delegator_id: string
          ends_at: string | null
          id: string
          modules: string[]
          reason: string | null
          starts_at: string
          structure_id: string | null
        }
        Insert: {
          active?: boolean
          created_at?: string
          delegate_id: string
          delegator_id: string
          ends_at?: string | null
          id?: string
          modules?: string[]
          reason?: string | null
          starts_at?: string
          structure_id?: string | null
        }
        Update: {
          active?: boolean
          created_at?: string
          delegate_id?: string
          delegator_id?: string
          ends_at?: string | null
          id?: string
          modules?: string[]
          reason?: string | null
          starts_at?: string
          structure_id?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "user_delegations_structure_id_fkey"
            columns: ["structure_id"]
            isOneToOne: false
            referencedRelation: "structures"
            referencedColumns: ["id"]
          },
        ]
      }
      user_roles: {
        Row: {
          created_at: string
          id: string
          role: Database["public"]["Enums"]["app_role"]
          structure_id: string | null
          user_id: string
        }
        Insert: {
          created_at?: string
          id?: string
          role: Database["public"]["Enums"]["app_role"]
          structure_id?: string | null
          user_id: string
        }
        Update: {
          created_at?: string
          id?: string
          role?: Database["public"]["Enums"]["app_role"]
          structure_id?: string | null
          user_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "user_roles_structure_id_fkey"
            columns: ["structure_id"]
            isOneToOne: false
            referencedRelation: "structures"
            referencedColumns: ["id"]
          },
        ]
      }
      utility_meters: {
        Row: {
          created_at: string
          id: string
          name: string
          notes: string | null
          pod_pdr: string | null
          serial_number: string | null
          structure_id: string
          supplier_id: string | null
          type: Database["public"]["Enums"]["utility_type"]
          unit: string
          updated_at: string
        }
        Insert: {
          created_at?: string
          id?: string
          name: string
          notes?: string | null
          pod_pdr?: string | null
          serial_number?: string | null
          structure_id: string
          supplier_id?: string | null
          type: Database["public"]["Enums"]["utility_type"]
          unit?: string
          updated_at?: string
        }
        Update: {
          created_at?: string
          id?: string
          name?: string
          notes?: string | null
          pod_pdr?: string | null
          serial_number?: string | null
          structure_id?: string
          supplier_id?: string | null
          type?: Database["public"]["Enums"]["utility_type"]
          unit?: string
          updated_at?: string
        }
        Relationships: [
          {
            foreignKeyName: "utility_meters_structure_id_fkey"
            columns: ["structure_id"]
            isOneToOne: false
            referencedRelation: "structures"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "utility_meters_supplier_id_fkey"
            columns: ["supplier_id"]
            isOneToOne: false
            referencedRelation: "supplier_compliance"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "utility_meters_supplier_id_fkey"
            columns: ["supplier_id"]
            isOneToOne: false
            referencedRelation: "suppliers"
            referencedColumns: ["id"]
          },
        ]
      }
      videocall_rooms: {
        Row: {
          created_by: string | null
          ended_at: string | null
          id: string
          room_name: string
          started_at: string
          structure_id: string | null
          ticket_id: string | null
          topic: string | null
        }
        Insert: {
          created_by?: string | null
          ended_at?: string | null
          id?: string
          room_name: string
          started_at?: string
          structure_id?: string | null
          ticket_id?: string | null
          topic?: string | null
        }
        Update: {
          created_by?: string | null
          ended_at?: string | null
          id?: string
          room_name?: string
          started_at?: string
          structure_id?: string | null
          ticket_id?: string | null
          topic?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "videocall_rooms_structure_id_fkey"
            columns: ["structure_id"]
            isOneToOne: false
            referencedRelation: "structures"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "videocall_rooms_ticket_id_fkey"
            columns: ["ticket_id"]
            isOneToOne: false
            referencedRelation: "tickets"
            referencedColumns: ["id"]
          },
        ]
      }
      work_orders: {
        Row: {
          area: Database["public"]["Enums"]["cost_area"] | null
          asset_id: string | null
          completed_at: string | null
          contract_id: string | null
          cost: number | null
          created_at: string
          created_by: string | null
          description: string | null
          id: string
          number: string | null
          report_text: string | null
          scheduled_at: string | null
          signature_url: string | null
          status: Database["public"]["Enums"]["work_order_status"]
          structure_id: string
          supplier_id: string | null
          ticket_id: string | null
          title: string
          updated_at: string
        }
        Insert: {
          area?: Database["public"]["Enums"]["cost_area"] | null
          asset_id?: string | null
          completed_at?: string | null
          contract_id?: string | null
          cost?: number | null
          created_at?: string
          created_by?: string | null
          description?: string | null
          id?: string
          number?: string | null
          report_text?: string | null
          scheduled_at?: string | null
          signature_url?: string | null
          status?: Database["public"]["Enums"]["work_order_status"]
          structure_id: string
          supplier_id?: string | null
          ticket_id?: string | null
          title: string
          updated_at?: string
        }
        Update: {
          area?: Database["public"]["Enums"]["cost_area"] | null
          asset_id?: string | null
          completed_at?: string | null
          contract_id?: string | null
          cost?: number | null
          created_at?: string
          created_by?: string | null
          description?: string | null
          id?: string
          number?: string | null
          report_text?: string | null
          scheduled_at?: string | null
          signature_url?: string | null
          status?: Database["public"]["Enums"]["work_order_status"]
          structure_id?: string
          supplier_id?: string | null
          ticket_id?: string | null
          title?: string
          updated_at?: string
        }
        Relationships: [
          {
            foreignKeyName: "work_orders_asset_id_fkey"
            columns: ["asset_id"]
            isOneToOne: false
            referencedRelation: "assets"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "work_orders_contract_id_fkey"
            columns: ["contract_id"]
            isOneToOne: false
            referencedRelation: "contracts"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "work_orders_structure_id_fkey"
            columns: ["structure_id"]
            isOneToOne: false
            referencedRelation: "structures"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "work_orders_supplier_id_fkey"
            columns: ["supplier_id"]
            isOneToOne: false
            referencedRelation: "supplier_compliance"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "work_orders_supplier_id_fkey"
            columns: ["supplier_id"]
            isOneToOne: false
            referencedRelation: "suppliers"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "work_orders_ticket_id_fkey"
            columns: ["ticket_id"]
            isOneToOne: false
            referencedRelation: "tickets"
            referencedColumns: ["id"]
          },
        ]
      }
      workflow_instances: {
        Row: {
          asset_id: string | null
          completed_at: string | null
          context: Json
          created_at: string
          current_step_id: string | null
          due_at: string | null
          id: string
          invoice_id: string | null
          started_at: string
          started_by: string | null
          status: Database["public"]["Enums"]["workflow_instance_status"]
          structure_id: string | null
          supplier_id: string | null
          ticket_id: string | null
          updated_at: string
          workflow_id: string
        }
        Insert: {
          asset_id?: string | null
          completed_at?: string | null
          context?: Json
          created_at?: string
          current_step_id?: string | null
          due_at?: string | null
          id?: string
          invoice_id?: string | null
          started_at?: string
          started_by?: string | null
          status?: Database["public"]["Enums"]["workflow_instance_status"]
          structure_id?: string | null
          supplier_id?: string | null
          ticket_id?: string | null
          updated_at?: string
          workflow_id: string
        }
        Update: {
          asset_id?: string | null
          completed_at?: string | null
          context?: Json
          created_at?: string
          current_step_id?: string | null
          due_at?: string | null
          id?: string
          invoice_id?: string | null
          started_at?: string
          started_by?: string | null
          status?: Database["public"]["Enums"]["workflow_instance_status"]
          structure_id?: string | null
          supplier_id?: string | null
          ticket_id?: string | null
          updated_at?: string
          workflow_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "workflow_instances_asset_id_fkey"
            columns: ["asset_id"]
            isOneToOne: false
            referencedRelation: "assets"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "workflow_instances_current_step_id_fkey"
            columns: ["current_step_id"]
            isOneToOne: false
            referencedRelation: "workflow_steps"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "workflow_instances_invoice_id_fkey"
            columns: ["invoice_id"]
            isOneToOne: false
            referencedRelation: "invoices"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "workflow_instances_structure_id_fkey"
            columns: ["structure_id"]
            isOneToOne: false
            referencedRelation: "structures"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "workflow_instances_supplier_id_fkey"
            columns: ["supplier_id"]
            isOneToOne: false
            referencedRelation: "supplier_compliance"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "workflow_instances_supplier_id_fkey"
            columns: ["supplier_id"]
            isOneToOne: false
            referencedRelation: "suppliers"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "workflow_instances_ticket_id_fkey"
            columns: ["ticket_id"]
            isOneToOne: false
            referencedRelation: "tickets"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "workflow_instances_workflow_id_fkey"
            columns: ["workflow_id"]
            isOneToOne: false
            referencedRelation: "workflows"
            referencedColumns: ["id"]
          },
        ]
      }
      workflow_steps: {
        Row: {
          assignee_role: Database["public"]["Enums"]["app_role"] | null
          assignee_user: string | null
          config: Json
          created_at: string
          id: string
          name: string
          next_step_id: string | null
          on_timeout: string
          position: number
          sla_minutes: number | null
          step_type: Database["public"]["Enums"]["workflow_step_type"]
          updated_at: string
          workflow_id: string
        }
        Insert: {
          assignee_role?: Database["public"]["Enums"]["app_role"] | null
          assignee_user?: string | null
          config?: Json
          created_at?: string
          id?: string
          name: string
          next_step_id?: string | null
          on_timeout?: string
          position: number
          sla_minutes?: number | null
          step_type: Database["public"]["Enums"]["workflow_step_type"]
          updated_at?: string
          workflow_id: string
        }
        Update: {
          assignee_role?: Database["public"]["Enums"]["app_role"] | null
          assignee_user?: string | null
          config?: Json
          created_at?: string
          id?: string
          name?: string
          next_step_id?: string | null
          on_timeout?: string
          position?: number
          sla_minutes?: number | null
          step_type?: Database["public"]["Enums"]["workflow_step_type"]
          updated_at?: string
          workflow_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "workflow_steps_next_step_id_fkey"
            columns: ["next_step_id"]
            isOneToOne: false
            referencedRelation: "workflow_steps"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "workflow_steps_workflow_id_fkey"
            columns: ["workflow_id"]
            isOneToOne: false
            referencedRelation: "workflows"
            referencedColumns: ["id"]
          },
        ]
      }
      workflow_transitions: {
        Row: {
          actor_id: string | null
          created_at: string
          duration_seconds: number | null
          from_step_id: string | null
          id: string
          instance_id: string
          note: string | null
          outcome: Database["public"]["Enums"]["workflow_transition_outcome"]
          payload: Json
          to_step_id: string | null
        }
        Insert: {
          actor_id?: string | null
          created_at?: string
          duration_seconds?: number | null
          from_step_id?: string | null
          id?: string
          instance_id: string
          note?: string | null
          outcome: Database["public"]["Enums"]["workflow_transition_outcome"]
          payload?: Json
          to_step_id?: string | null
        }
        Update: {
          actor_id?: string | null
          created_at?: string
          duration_seconds?: number | null
          from_step_id?: string | null
          id?: string
          instance_id?: string
          note?: string | null
          outcome?: Database["public"]["Enums"]["workflow_transition_outcome"]
          payload?: Json
          to_step_id?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "workflow_transitions_from_step_id_fkey"
            columns: ["from_step_id"]
            isOneToOne: false
            referencedRelation: "workflow_steps"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "workflow_transitions_instance_id_fkey"
            columns: ["instance_id"]
            isOneToOne: false
            referencedRelation: "workflow_instances"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "workflow_transitions_to_step_id_fkey"
            columns: ["to_step_id"]
            isOneToOne: false
            referencedRelation: "workflow_steps"
            referencedColumns: ["id"]
          },
        ]
      }
      workflows: {
        Row: {
          active: boolean
          created_at: string
          created_by: string | null
          description: string | null
          id: string
          name: string
          structure_id: string | null
          trigger_config: Json
          trigger_type: Database["public"]["Enums"]["workflow_trigger"]
          updated_at: string
          version: number
        }
        Insert: {
          active?: boolean
          created_at?: string
          created_by?: string | null
          description?: string | null
          id?: string
          name: string
          structure_id?: string | null
          trigger_config?: Json
          trigger_type?: Database["public"]["Enums"]["workflow_trigger"]
          updated_at?: string
          version?: number
        }
        Update: {
          active?: boolean
          created_at?: string
          created_by?: string | null
          description?: string | null
          id?: string
          name?: string
          structure_id?: string | null
          trigger_config?: Json
          trigger_type?: Database["public"]["Enums"]["workflow_trigger"]
          updated_at?: string
          version?: number
        }
        Relationships: [
          {
            foreignKeyName: "workflows_structure_id_fkey"
            columns: ["structure_id"]
            isOneToOne: false
            referencedRelation: "structures"
            referencedColumns: ["id"]
          },
        ]
      }
    }
    Views: {
      low_stock_items: {
        Row: {
          estimated_cost: number | null
          id: string | null
          min_quantity: number | null
          name: string | null
          quantity: number | null
          shortage: number | null
          sku: string | null
          structure_id: string | null
          supplier_id: string | null
          unit: string | null
          unit_cost: number | null
        }
        Insert: {
          estimated_cost?: never
          id?: string | null
          min_quantity?: number | null
          name?: string | null
          quantity?: number | null
          shortage?: never
          sku?: string | null
          structure_id?: string | null
          supplier_id?: string | null
          unit?: string | null
          unit_cost?: number | null
        }
        Update: {
          estimated_cost?: never
          id?: string | null
          min_quantity?: number | null
          name?: string | null
          quantity?: number | null
          shortage?: never
          sku?: string | null
          structure_id?: string | null
          supplier_id?: string | null
          unit?: string | null
          unit_cost?: number | null
        }
        Relationships: [
          {
            foreignKeyName: "inventory_items_structure_id_fkey"
            columns: ["structure_id"]
            isOneToOne: false
            referencedRelation: "structures"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "inventory_items_supplier_id_fkey"
            columns: ["supplier_id"]
            isOneToOne: false
            referencedRelation: "supplier_compliance"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "inventory_items_supplier_id_fkey"
            columns: ["supplier_id"]
            isOneToOne: false
            referencedRelation: "suppliers"
            referencedColumns: ["id"]
          },
        ]
      }
      public_profiles: {
        Row: {
          avatar_url: string | null
          full_name: string | null
          id: string | null
        }
        Insert: {
          avatar_url?: string | null
          full_name?: string | null
          id?: string | null
        }
        Update: {
          avatar_url?: string | null
          full_name?: string | null
          id?: string | null
        }
        Relationships: []
      }
      supplier_compliance: {
        Row: {
          address: string | null
          blocked: boolean | null
          category: string | null
          certifications: Json | null
          compliance_status: string | null
          contact_person: string | null
          created_at: string | null
          durc_expiry: string | null
          email: string | null
          haccp_expiry: string | null
          id: string | null
          insurance_expiry: string | null
          name: string | null
          next_expiry: string | null
          notes: string | null
          phone: string | null
          rating: number | null
          status: Database["public"]["Enums"]["supplier_status"] | null
          structure_id: string | null
          updated_at: string | null
          vat_number: string | null
          visura_expiry: string | null
        }
        Insert: {
          address?: string | null
          blocked?: boolean | null
          category?: string | null
          certifications?: Json | null
          compliance_status?: never
          contact_person?: string | null
          created_at?: string | null
          durc_expiry?: string | null
          email?: string | null
          haccp_expiry?: string | null
          id?: string | null
          insurance_expiry?: string | null
          name?: string | null
          next_expiry?: never
          notes?: string | null
          phone?: string | null
          rating?: number | null
          status?: Database["public"]["Enums"]["supplier_status"] | null
          structure_id?: string | null
          updated_at?: string | null
          vat_number?: string | null
          visura_expiry?: string | null
        }
        Update: {
          address?: string | null
          blocked?: boolean | null
          category?: string | null
          certifications?: Json | null
          compliance_status?: never
          contact_person?: string | null
          created_at?: string | null
          durc_expiry?: string | null
          email?: string | null
          haccp_expiry?: string | null
          id?: string | null
          insurance_expiry?: string | null
          name?: string | null
          next_expiry?: never
          notes?: string | null
          phone?: string | null
          rating?: number | null
          status?: Database["public"]["Enums"]["supplier_status"] | null
          structure_id?: string | null
          updated_at?: string | null
          vat_number?: string | null
          visura_expiry?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "suppliers_structure_id_fkey"
            columns: ["structure_id"]
            isOneToOne: false
            referencedRelation: "structures"
            referencedColumns: ["id"]
          },
        ]
      }
    }
    Functions: {
      can_manage_template: {
        Args: { _template: string; _user: string }
        Returns: boolean
      }
      enqueue_sla_warnings: {
        Args: { p_threshold_minutes?: number }
        Returns: number
      }
      generate_maintenance_tasks: {
        Args: { _from: string; _to: string }
        Returns: number
      }
      has_permission: {
        Args: {
          _action?: string
          _module: string
          _structure?: string
          _user: string
        }
        Returns: boolean
      }
      has_role: {
        Args: {
          _role: Database["public"]["Enums"]["app_role"]
          _structure_id?: string
          _user_id: string
        }
        Returns: boolean
      }
      has_structure_access: {
        Args: { _structure_id: string; _user_id: string }
        Returns: boolean
      }
      is_admin: { Args: { _user_id: string }; Returns: boolean }
      is_conversation_member: {
        Args: { _conv: string; _user: string }
        Returns: boolean
      }
      user_has_ticket_access: {
        Args: { _ticket_id: string; _user: string }
        Returns: boolean
      }
    }
    Enums: {
      app_role:
        | "super_admin"
        | "direttore"
        | "facility_manager"
        | "manutentore"
        | "fornitore"
        | "economato"
        | "viewer"
      asset_status: "attivo" | "in_manutenzione" | "guasto" | "dismesso"
      contract_status: "bozza" | "attivo" | "scaduto" | "disdetto"
      contract_type: "canone" | "consumo" | "intervento" | "misto"
      cost_area:
        | "camere"
        | "spa"
        | "ristorante"
        | "cucina"
        | "aree_comuni"
        | "esterno"
        | "uffici"
        | "altro"
      invoice_status:
        | "da_pagare"
        | "pagata"
        | "scaduta"
        | "contestata"
        | "annullata"
      maintenance_frequency:
        | "giornaliera"
        | "settimanale"
        | "mensile"
        | "trimestrale"
        | "semestrale"
        | "annuale"
        | "custom"
      notification_channel_type: "email" | "teams"
      notification_event:
        | "ticket_created"
        | "ticket_assigned"
        | "sla_warning"
        | "sla_violated"
        | "workflow_step"
        | "invoice_due"
        | "maintenance_due"
      reorder_status:
        | "da_approvare"
        | "approvato"
        | "ordinato"
        | "ricevuto"
        | "annullato"
      supplier_status: "attivo" | "sospeso" | "dismesso"
      ticket_priority: "bassa" | "media" | "alta" | "critica"
      ticket_status:
        | "aperto"
        | "assegnato"
        | "in_corso"
        | "sospeso"
        | "risolto"
        | "chiuso"
        | "annullato"
      utility_type:
        | "elettricita"
        | "gas"
        | "acqua"
        | "gasolio"
        | "teleriscaldamento"
        | "altro"
      work_order_status:
        | "aperto"
        | "programmato"
        | "in_corso"
        | "completato"
        | "annullato"
      workflow_instance_status:
        | "running"
        | "completed"
        | "cancelled"
        | "failed"
        | "waiting"
      workflow_step_type:
        | "approval"
        | "action"
        | "notification"
        | "wait"
        | "condition"
        | "form"
      workflow_transition_outcome:
        | "approved"
        | "rejected"
        | "completed"
        | "skipped"
        | "timeout"
        | "escalated"
        | "cancelled"
      workflow_trigger:
        | "manual"
        | "ticket_opened"
        | "ticket_resolved"
        | "contract_expiring"
        | "invoice_received"
        | "asset_created"
        | "maintenance_due"
        | "custom"
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
      app_role: [
        "super_admin",
        "direttore",
        "facility_manager",
        "manutentore",
        "fornitore",
        "economato",
        "viewer",
      ],
      asset_status: ["attivo", "in_manutenzione", "guasto", "dismesso"],
      contract_status: ["bozza", "attivo", "scaduto", "disdetto"],
      contract_type: ["canone", "consumo", "intervento", "misto"],
      cost_area: [
        "camere",
        "spa",
        "ristorante",
        "cucina",
        "aree_comuni",
        "esterno",
        "uffici",
        "altro",
      ],
      invoice_status: [
        "da_pagare",
        "pagata",
        "scaduta",
        "contestata",
        "annullata",
      ],
      maintenance_frequency: [
        "giornaliera",
        "settimanale",
        "mensile",
        "trimestrale",
        "semestrale",
        "annuale",
        "custom",
      ],
      notification_channel_type: ["email", "teams"],
      notification_event: [
        "ticket_created",
        "ticket_assigned",
        "sla_warning",
        "sla_violated",
        "workflow_step",
        "invoice_due",
        "maintenance_due",
      ],
      reorder_status: [
        "da_approvare",
        "approvato",
        "ordinato",
        "ricevuto",
        "annullato",
      ],
      supplier_status: ["attivo", "sospeso", "dismesso"],
      ticket_priority: ["bassa", "media", "alta", "critica"],
      ticket_status: [
        "aperto",
        "assegnato",
        "in_corso",
        "sospeso",
        "risolto",
        "chiuso",
        "annullato",
      ],
      utility_type: [
        "elettricita",
        "gas",
        "acqua",
        "gasolio",
        "teleriscaldamento",
        "altro",
      ],
      work_order_status: [
        "aperto",
        "programmato",
        "in_corso",
        "completato",
        "annullato",
      ],
      workflow_instance_status: [
        "running",
        "completed",
        "cancelled",
        "failed",
        "waiting",
      ],
      workflow_step_type: [
        "approval",
        "action",
        "notification",
        "wait",
        "condition",
        "form",
      ],
      workflow_transition_outcome: [
        "approved",
        "rejected",
        "completed",
        "skipped",
        "timeout",
        "escalated",
        "cancelled",
      ],
      workflow_trigger: [
        "manual",
        "ticket_opened",
        "ticket_resolved",
        "contract_expiring",
        "invoice_received",
        "asset_created",
        "maintenance_due",
        "custom",
      ],
    },
  },
} as const
