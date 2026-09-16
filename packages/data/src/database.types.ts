
export type Json = string | number | boolean | null | { [key: string]: Json | undefined } | Json[]

export type Database = {
  
  "graphql_public": {
          Tables: {
            [_ in never]: never
          }
          Views: {
            [_ in never]: never
          }
          Functions: {
            "graphql":
{ Args: { "extensions"?: Json,"operationName"?: string,"query"?: string,"variables"?: Json }; Returns: Json
                           }
          }
          Enums: {
            [_ in never]: never
          }
          CompositeTypes: {
            [_ in never]: never
          }
        },"public": {
          Tables: {
            "activity_log": {
                  Row: {
                    "actor_id": string | null,"created_at": string,"entity_id": string | null,"entity_type": string,"family_id": string,"id": string,"summary": NonNullable<Json>,"verb": string
                  }
                  Insert: {
                    "actor_id"?: string | null,"created_at"?: string,"entity_id"?: string | null,"entity_type": string,"family_id": string,"id"?: string,"summary"?: NonNullable<Json>,"verb": string
                  }
                  Update: {
                    "actor_id"?: string | null,"created_at"?: string,"entity_id"?: string | null,"entity_type"?: string,"family_id"?: string,"id"?: string,"summary"?: NonNullable<Json>,"verb"?: string
                  }
                  Relationships: [
                    {
      foreignKeyName: "activity_log_actor_id_fkey"
      columns: ["actor_id"]
isOneToOne: false
      referencedRelation: "profiles"
      referencedColumns: ["id"]
    },{
      foreignKeyName: "activity_log_family_id_fkey"
      columns: ["family_id"]
isOneToOne: false
      referencedRelation: "families"
      referencedColumns: ["id"]
    }
                  ]
                },"categories": {
                  Row: {
                    "created_at": string,"deleted_at": string | null,"family_id": string,"id": string,"name": string,"position": number,"updated_at": string
                  }
                  Insert: {
                    "created_at"?: string,"deleted_at"?: string | null,"family_id": string,"id"?: string,"name": string,"position"?: number,"updated_at"?: string
                  }
                  Update: {
                    "created_at"?: string,"deleted_at"?: string | null,"family_id"?: string,"id"?: string,"name"?: string,"position"?: number,"updated_at"?: string
                  }
                  Relationships: [
                    {
      foreignKeyName: "categories_family_id_fkey"
      columns: ["family_id"]
isOneToOne: false
      referencedRelation: "families"
      referencedColumns: ["id"]
    }
                  ]
                },"check_ins": {
                  Row: {
                    "accuracy_m": number | null,"created_at": string,"family_id": string,"id": string,"lat": number | null,"lng": number | null,"note": string | null,"user_id": string
                  }
                  Insert: {
                    "accuracy_m"?: number | null,"created_at"?: string,"family_id": string,"id"?: string,"lat"?: number | null,"lng"?: number | null,"note"?: string | null,"user_id": string
                  }
                  Update: {
                    "accuracy_m"?: number | null,"created_at"?: string,"family_id"?: string,"id"?: string,"lat"?: number | null,"lng"?: number | null,"note"?: string | null,"user_id"?: string
                  }
                  Relationships: [
                    {
      foreignKeyName: "check_ins_family_id_fkey"
      columns: ["family_id"]
isOneToOne: false
      referencedRelation: "families"
      referencedColumns: ["id"]
    },{
      foreignKeyName: "check_ins_user_id_fkey"
      columns: ["user_id"]
isOneToOne: false
      referencedRelation: "profiles"
      referencedColumns: ["id"]
    }
                  ]
                },"event_exceptions": {
                  Row: {
                    "created_at": string,"deleted_at": string | null,"event_id": string,"family_id": string,"id": string,"is_cancelled": boolean,"original_start": string,"override": NonNullable<Json>,"updated_at": string
                  }
                  Insert: {
                    "created_at"?: string,"deleted_at"?: string | null,"event_id": string,"family_id": string,"id"?: string,"is_cancelled"?: boolean,"original_start": string,"override"?: NonNullable<Json>,"updated_at"?: string
                  }
                  Update: {
                    "created_at"?: string,"deleted_at"?: string | null,"event_id"?: string,"family_id"?: string,"id"?: string,"is_cancelled"?: boolean,"original_start"?: string,"override"?: NonNullable<Json>,"updated_at"?: string
                  }
                  Relationships: [
                    {
      foreignKeyName: "event_exceptions_event_id_fkey"
      columns: ["event_id"]
isOneToOne: false
      referencedRelation: "events"
      referencedColumns: ["id"]
    },{
      foreignKeyName: "event_exceptions_family_id_fkey"
      columns: ["family_id"]
isOneToOne: false
      referencedRelation: "families"
      referencedColumns: ["id"]
    }
                  ]
                },"events": {
                  Row: {
                    "all_day": boolean,"created_at": string,"created_by": string | null,"deleted_at": string | null,"ends_at": string,"family_id": string,"id": string,"location_text": string | null,"note": string | null,"participant_ids": (string)[],"reminder_minutes": number | null,"rrule": string | null,"starts_at": string,"timezone": string,"title": string,"updated_at": string
                  }
                  Insert: {
                    "all_day"?: boolean,"created_at"?: string,"created_by"?: string | null,"deleted_at"?: string | null,"ends_at": string,"family_id": string,"id"?: string,"location_text"?: string | null,"note"?: string | null,"participant_ids"?: (string)[],"reminder_minutes"?: number | null,"rrule"?: string | null,"starts_at": string,"timezone"?: string,"title": string,"updated_at"?: string
                  }
                  Update: {
                    "all_day"?: boolean,"created_at"?: string,"created_by"?: string | null,"deleted_at"?: string | null,"ends_at"?: string,"family_id"?: string,"id"?: string,"location_text"?: string | null,"note"?: string | null,"participant_ids"?: (string)[],"reminder_minutes"?: number | null,"rrule"?: string | null,"starts_at"?: string,"timezone"?: string,"title"?: string,"updated_at"?: string
                  }
                  Relationships: [
                    {
      foreignKeyName: "events_created_by_fkey"
      columns: ["created_by"]
isOneToOne: false
      referencedRelation: "profiles"
      referencedColumns: ["id"]
    },{
      foreignKeyName: "events_family_id_fkey"
      columns: ["family_id"]
isOneToOne: false
      referencedRelation: "families"
      referencedColumns: ["id"]
    }
                  ]
                },"families": {
                  Row: {
                    "created_at": string,"created_by": string | null,"deleted_at": string | null,"id": string,"name": string,"updated_at": string
                  }
                  Insert: {
                    "created_at"?: string,"created_by"?: string | null,"deleted_at"?: string | null,"id"?: string,"name": string,"updated_at"?: string
                  }
                  Update: {
                    "created_at"?: string,"created_by"?: string | null,"deleted_at"?: string | null,"id"?: string,"name"?: string,"updated_at"?: string
                  }
                  Relationships: [
                    {
      foreignKeyName: "families_created_by_fkey"
      columns: ["created_by"]
isOneToOne: false
      referencedRelation: "profiles"
      referencedColumns: ["id"]
    }
                  ]
                },"family_members": {
                  Row: {
                    "created_at": string,"family_id": string,"joined_at": string,"role": Database["public"]['Enums']["role_t"],"updated_at": string,"user_id": string
                  }
                  Insert: {
                    "created_at"?: string,"family_id": string,"joined_at"?: string,"role": Database["public"]['Enums']["role_t"],"updated_at"?: string,"user_id": string
                  }
                  Update: {
                    "created_at"?: string,"family_id"?: string,"joined_at"?: string,"role"?: Database["public"]['Enums']["role_t"],"updated_at"?: string,"user_id"?: string
                  }
                  Relationships: [
                    {
      foreignKeyName: "family_members_family_id_fkey"
      columns: ["family_id"]
isOneToOne: false
      referencedRelation: "families"
      referencedColumns: ["id"]
    },{
      foreignKeyName: "family_members_user_id_fkey"
      columns: ["user_id"]
isOneToOne: true
      referencedRelation: "profiles"
      referencedColumns: ["id"]
    }
                  ]
                },"invite_attempts": {
                  Row: {
                    "attempted_at": string,"user_id": string
                  }
                  Insert: {
                    "attempted_at"?: string,"user_id": string
                  }
                  Update: {
                    "attempted_at"?: string,"user_id"?: string
                  }
                  Relationships: [
                    
                  ]
                },"invites": {
                  Row: {
                    "code": string,"created_at": string,"created_by": string | null,"expires_at": string,"family_id": string,"id": string,"max_uses": number,"revoked_at": string | null,"role": Database["public"]['Enums']["role_t"],"token": string,"updated_at": string,"uses": number
                  }
                  Insert: {
                    "code": string,"created_at"?: string,"created_by"?: string | null,"expires_at"?: string,"family_id": string,"id"?: string,"max_uses"?: number,"revoked_at"?: string | null,"role": Database["public"]['Enums']["role_t"],"token": string,"updated_at"?: string,"uses"?: number
                  }
                  Update: {
                    "code"?: string,"created_at"?: string,"created_by"?: string | null,"expires_at"?: string,"family_id"?: string,"id"?: string,"max_uses"?: number,"revoked_at"?: string | null,"role"?: Database["public"]['Enums']["role_t"],"token"?: string,"updated_at"?: string,"uses"?: number
                  }
                  Relationships: [
                    {
      foreignKeyName: "invites_created_by_fkey"
      columns: ["created_by"]
isOneToOne: false
      referencedRelation: "profiles"
      referencedColumns: ["id"]
    },{
      foreignKeyName: "invites_family_id_fkey"
      columns: ["family_id"]
isOneToOne: false
      referencedRelation: "families"
      referencedColumns: ["id"]
    }
                  ]
                },"item_history": {
                  Row: {
                    "category_id": string | null,"family_id": string,"last_used_at": string,"title": string,"title_normalized": string,"use_count": number
                  }
                  Insert: {
                    "category_id"?: string | null,"family_id": string,"last_used_at"?: string,"title": string,"title_normalized": string,"use_count"?: number
                  }
                  Update: {
                    "category_id"?: string | null,"family_id"?: string,"last_used_at"?: string,"title"?: string,"title_normalized"?: string,"use_count"?: number
                  }
                  Relationships: [
                    {
      foreignKeyName: "item_history_category_id_fkey"
      columns: ["category_id"]
isOneToOne: false
      referencedRelation: "categories"
      referencedColumns: ["id"]
    },{
      foreignKeyName: "item_history_family_id_fkey"
      columns: ["family_id"]
isOneToOne: false
      referencedRelation: "families"
      referencedColumns: ["id"]
    }
                  ]
                },"list_items": {
                  Row: {
                    "assignee_id": string | null,"category_id": string | null,"created_at": string,"created_by": string | null,"deleted_at": string | null,"done_at": string | null,"done_by": string | null,"due_at": string | null,"family_id": string,"id": string,"is_done": boolean,"list_id": string,"note": string | null,"position": number,"quantity": number | null,"title": string,"unit": string | null,"updated_at": string
                  }
                  Insert: {
                    "assignee_id"?: string | null,"category_id"?: string | null,"created_at"?: string,"created_by"?: string | null,"deleted_at"?: string | null,"done_at"?: string | null,"done_by"?: string | null,"due_at"?: string | null,"family_id": string,"id"?: string,"is_done"?: boolean,"list_id": string,"note"?: string | null,"position"?: number,"quantity"?: number | null,"title": string,"unit"?: string | null,"updated_at"?: string
                  }
                  Update: {
                    "assignee_id"?: string | null,"category_id"?: string | null,"created_at"?: string,"created_by"?: string | null,"deleted_at"?: string | null,"done_at"?: string | null,"done_by"?: string | null,"due_at"?: string | null,"family_id"?: string,"id"?: string,"is_done"?: boolean,"list_id"?: string,"note"?: string | null,"position"?: number,"quantity"?: number | null,"title"?: string,"unit"?: string | null,"updated_at"?: string
                  }
                  Relationships: [
                    {
      foreignKeyName: "list_items_assignee_id_fkey"
      columns: ["assignee_id"]
isOneToOne: false
      referencedRelation: "profiles"
      referencedColumns: ["id"]
    },{
      foreignKeyName: "list_items_category_id_fkey"
      columns: ["category_id"]
isOneToOne: false
      referencedRelation: "categories"
      referencedColumns: ["id"]
    },{
      foreignKeyName: "list_items_created_by_fkey"
      columns: ["created_by"]
isOneToOne: false
      referencedRelation: "profiles"
      referencedColumns: ["id"]
    },{
      foreignKeyName: "list_items_done_by_fkey"
      columns: ["done_by"]
isOneToOne: false
      referencedRelation: "profiles"
      referencedColumns: ["id"]
    },{
      foreignKeyName: "list_items_family_id_fkey"
      columns: ["family_id"]
isOneToOne: false
      referencedRelation: "families"
      referencedColumns: ["id"]
    },{
      foreignKeyName: "list_items_list_id_fkey"
      columns: ["list_id"]
isOneToOne: false
      referencedRelation: "lists"
      referencedColumns: ["id"]
    }
                  ]
                },"lists": {
                  Row: {
                    "archived_at": string | null,"created_at": string,"created_by": string | null,"deleted_at": string | null,"family_id": string,"id": string,"name": string,"position": number,"type": Database["public"]['Enums']["list_type"],"updated_at": string
                  }
                  Insert: {
                    "archived_at"?: string | null,"created_at"?: string,"created_by"?: string | null,"deleted_at"?: string | null,"family_id": string,"id"?: string,"name": string,"position"?: number,"type"?: Database["public"]['Enums']["list_type"],"updated_at"?: string
                  }
                  Update: {
                    "archived_at"?: string | null,"created_at"?: string,"created_by"?: string | null,"deleted_at"?: string | null,"family_id"?: string,"id"?: string,"name"?: string,"position"?: number,"type"?: Database["public"]['Enums']["list_type"],"updated_at"?: string
                  }
                  Relationships: [
                    {
      foreignKeyName: "lists_created_by_fkey"
      columns: ["created_by"]
isOneToOne: false
      referencedRelation: "profiles"
      referencedColumns: ["id"]
    },{
      foreignKeyName: "lists_family_id_fkey"
      columns: ["family_id"]
isOneToOne: false
      referencedRelation: "families"
      referencedColumns: ["id"]
    }
                  ]
                },"location_latest": {
                  Row: {
                    "accuracy_m": number | null,"battery_pct": number | null,"family_id": string,"lat": number,"lng": number,"recorded_at": string,"updated_at": string,"user_id": string
                  }
                  Insert: {
                    "accuracy_m"?: number | null,"battery_pct"?: number | null,"family_id": string,"lat": number,"lng": number,"recorded_at": string,"updated_at"?: string,"user_id": string
                  }
                  Update: {
                    "accuracy_m"?: number | null,"battery_pct"?: number | null,"family_id"?: string,"lat"?: number,"lng"?: number,"recorded_at"?: string,"updated_at"?: string,"user_id"?: string
                  }
                  Relationships: [
                    {
      foreignKeyName: "location_latest_family_id_fkey"
      columns: ["family_id"]
isOneToOne: false
      referencedRelation: "families"
      referencedColumns: ["id"]
    },{
      foreignKeyName: "location_latest_user_id_fkey"
      columns: ["user_id"]
isOneToOne: true
      referencedRelation: "profiles"
      referencedColumns: ["id"]
    }
                  ]
                },"location_points": {
                  Row: {
                    "accuracy_m": number | null,"family_id": string,"id": number,"lat": number,"lng": number,"recorded_at": string,"user_id": string
                  }
                  Insert: {
                    "accuracy_m"?: number | null,"family_id": string,"id"?: never,"lat": number,"lng": number,"recorded_at": string,"user_id": string
                  }
                  Update: {
                    "accuracy_m"?: number | null,"family_id"?: string,"id"?: never,"lat"?: number,"lng"?: number,"recorded_at"?: string,"user_id"?: string
                  }
                  Relationships: [
                    {
      foreignKeyName: "location_points_family_id_fkey"
      columns: ["family_id"]
isOneToOne: false
      referencedRelation: "families"
      referencedColumns: ["id"]
    },{
      foreignKeyName: "location_points_user_id_fkey"
      columns: ["user_id"]
isOneToOne: false
      referencedRelation: "profiles"
      referencedColumns: ["id"]
    }
                  ]
                },"location_requests": {
                  Row: {
                    "answered_at": string | null,"created_at": string,"family_id": string,"from_user": string,"id": string,"to_user": string
                  }
                  Insert: {
                    "answered_at"?: string | null,"created_at"?: string,"family_id": string,"from_user": string,"id"?: string,"to_user": string
                  }
                  Update: {
                    "answered_at"?: string | null,"created_at"?: string,"family_id"?: string,"from_user"?: string,"id"?: string,"to_user"?: string
                  }
                  Relationships: [
                    {
      foreignKeyName: "location_requests_family_id_fkey"
      columns: ["family_id"]
isOneToOne: false
      referencedRelation: "families"
      referencedColumns: ["id"]
    },{
      foreignKeyName: "location_requests_from_user_fkey"
      columns: ["from_user"]
isOneToOne: false
      referencedRelation: "profiles"
      referencedColumns: ["id"]
    },{
      foreignKeyName: "location_requests_to_user_fkey"
      columns: ["to_user"]
isOneToOne: false
      referencedRelation: "profiles"
      referencedColumns: ["id"]
    }
                  ]
                },"location_settings": {
                  Row: {
                    "allowed_by": string | null,"family_id": string,"mode": Database["public"]['Enums']["location_mode"],"paused_until": string | null,"updated_at": string,"user_id": string
                  }
                  Insert: {
                    "allowed_by"?: string | null,"family_id": string,"mode"?: Database["public"]['Enums']["location_mode"],"paused_until"?: string | null,"updated_at"?: string,"user_id": string
                  }
                  Update: {
                    "allowed_by"?: string | null,"family_id"?: string,"mode"?: Database["public"]['Enums']["location_mode"],"paused_until"?: string | null,"updated_at"?: string,"user_id"?: string
                  }
                  Relationships: [
                    {
      foreignKeyName: "location_settings_allowed_by_fkey"
      columns: ["allowed_by"]
isOneToOne: false
      referencedRelation: "profiles"
      referencedColumns: ["id"]
    },{
      foreignKeyName: "location_settings_family_id_fkey"
      columns: ["family_id"]
isOneToOne: false
      referencedRelation: "families"
      referencedColumns: ["id"]
    },{
      foreignKeyName: "location_settings_user_id_fkey"
      columns: ["user_id"]
isOneToOne: true
      referencedRelation: "profiles"
      referencedColumns: ["id"]
    }
                  ]
                },"notification_prefs": {
                  Row: {
                    "event_reminder": boolean,"item_assigned": boolean,"list_changed": boolean,"location_request": boolean,"member_joined": boolean,"quiet_end": string,"quiet_start": string,"updated_at": string,"user_id": string
                  }
                  Insert: {
                    "event_reminder"?: boolean,"item_assigned"?: boolean,"list_changed"?: boolean,"location_request"?: boolean,"member_joined"?: boolean,"quiet_end"?: string,"quiet_start"?: string,"updated_at"?: string,"user_id": string
                  }
                  Update: {
                    "event_reminder"?: boolean,"item_assigned"?: boolean,"list_changed"?: boolean,"location_request"?: boolean,"member_joined"?: boolean,"quiet_end"?: string,"quiet_start"?: string,"updated_at"?: string,"user_id"?: string
                  }
                  Relationships: [
                    {
      foreignKeyName: "notification_prefs_user_id_fkey"
      columns: ["user_id"]
isOneToOne: true
      referencedRelation: "profiles"
      referencedColumns: ["id"]
    }
                  ]
                },"notification_queue": {
                  Row: {
                    "body": string | null,"category": string | null,"created_at": string,"data": NonNullable<Json>,"dedupe_key": string | null,"error": string | null,"family_id": string | null,"id": string,"ignore_quiet": boolean,"sent_at": string | null,"silent": boolean,"title": string | null,"type": Database["public"]['Enums']["notification_type"],"user_id": string
                  }
                  Insert: {
                    "body"?: string | null,"category"?: string | null,"created_at"?: string,"data"?: NonNullable<Json>,"dedupe_key"?: string | null,"error"?: string | null,"family_id"?: string | null,"id"?: string,"ignore_quiet"?: boolean,"sent_at"?: string | null,"silent"?: boolean,"title"?: string | null,"type": Database["public"]['Enums']["notification_type"],"user_id": string
                  }
                  Update: {
                    "body"?: string | null,"category"?: string | null,"created_at"?: string,"data"?: NonNullable<Json>,"dedupe_key"?: string | null,"error"?: string | null,"family_id"?: string | null,"id"?: string,"ignore_quiet"?: boolean,"sent_at"?: string | null,"silent"?: boolean,"title"?: string | null,"type"?: Database["public"]['Enums']["notification_type"],"user_id"?: string
                  }
                  Relationships: [
                    {
      foreignKeyName: "notification_queue_family_id_fkey"
      columns: ["family_id"]
isOneToOne: false
      referencedRelation: "families"
      referencedColumns: ["id"]
    },{
      foreignKeyName: "notification_queue_user_id_fkey"
      columns: ["user_id"]
isOneToOne: false
      referencedRelation: "profiles"
      referencedColumns: ["id"]
    }
                  ]
                },"profiles": {
                  Row: {
                    "avatar_url": string | null,"birthday": string | null,"color": string | null,"created_at": string,"display_name": string,"id": string,"locale": string,"timezone": string,"updated_at": string
                  }
                  Insert: {
                    "avatar_url"?: string | null,"birthday"?: string | null,"color"?: string | null,"created_at"?: string,"display_name"?: string,"id": string,"locale"?: string,"timezone"?: string,"updated_at"?: string
                  }
                  Update: {
                    "avatar_url"?: string | null,"birthday"?: string | null,"color"?: string | null,"created_at"?: string,"display_name"?: string,"id"?: string,"locale"?: string,"timezone"?: string,"updated_at"?: string
                  }
                  Relationships: [
                    
                  ]
                },"push_tokens": {
                  Row: {
                    "created_at": string,"device_name": string | null,"id": string,"last_seen_at": string,"platform": Database["public"]['Enums']["device_platform"],"provider": Database["public"]['Enums']["push_provider"],"token": string,"updated_at": string,"user_id": string,"web_endpoint": string | null,"web_keys": Json | null
                  }
                  Insert: {
                    "created_at"?: string,"device_name"?: string | null,"id"?: string,"last_seen_at"?: string,"platform": Database["public"]['Enums']["device_platform"],"provider"?: Database["public"]['Enums']["push_provider"],"token": string,"updated_at"?: string,"user_id": string,"web_endpoint"?: string | null,"web_keys"?: Json | null
                  }
                  Update: {
                    "created_at"?: string,"device_name"?: string | null,"id"?: string,"last_seen_at"?: string,"platform"?: Database["public"]['Enums']["device_platform"],"provider"?: Database["public"]['Enums']["push_provider"],"token"?: string,"updated_at"?: string,"user_id"?: string,"web_endpoint"?: string | null,"web_keys"?: Json | null
                  }
                  Relationships: [
                    {
      foreignKeyName: "push_tokens_user_id_fkey"
      columns: ["user_id"]
isOneToOne: false
      referencedRelation: "profiles"
      referencedColumns: ["id"]
    }
                  ]
                }
          }
          Views: {
            [_ in never]: never
          }
          Functions: {
            "accept_invite":
{ Args: { "p_code"?: string,"p_token"?: string }; Returns: Json
                           },
"allow_child_location":
{ Args: { "p_allowed": boolean,"p_child": string }; Returns: undefined
                           },
"answer_location_requests":
{ Args: { "uid": string }; Returns: undefined
                           },
"can_edit_event":
{ Args: { "creator": string,"fid": string }; Returns: boolean
                           },
"check_in":
{ Args: { "p_accuracy"?: number,"p_lat"?: number,"p_lng"?: number,"p_note"?: string }; Returns: {
              "accuracy_m": number | null,
"created_at": string,
"family_id": string,
"id": string,
"lat": number | null,
"lng": number | null,
"note": string | null,
"user_id": string
            }
                          SetofOptions: {
        from: "*"
        to: "check_ins"
        isOneToOne: true
        isSetofReturn: false
      } },
"claim_notifications":
{ Args: { "p_limit"?: number }; Returns: {
              "body": string,"category": string,"data": Json,"id": string,"quiet": boolean,"silent": boolean,"title": string,"tokens": (string)[],"type": Database["public"]['Enums']["notification_type"]
            }[]
                           },
"clear_bought_items":
{ Args: Record<PropertyKey, never>; Returns: undefined
                           },
"create_family":
{ Args: { "name": string }; Returns: {
              "created_at": string,
"created_by": string | null,
"deleted_at": string | null,
"id": string,
"name": string,
"updated_at": string
            }
                          SetofOptions: {
        from: "*"
        to: "families"
        isOneToOne: true
        isSetofReturn: false
      } },
"create_invite":
{ Args: { "p_family_id": string,"p_max_uses"?: number,"p_role": Database["public"]['Enums']["role_t"] }; Returns: {
              "code": string,
"created_at": string,
"created_by": string | null,
"expires_at": string,
"family_id": string,
"id": string,
"max_uses": number,
"revoked_at": string | null,
"role": Database["public"]['Enums']["role_t"],
"token": string,
"updated_at": string,
"uses": number
            }
                          SetofOptions: {
        from: "*"
        to: "invites"
        isOneToOne: true
        isSetofReturn: false
      } },
"delete_account":
{ Args: Record<PropertyKey, never>; Returns: undefined
                           },
"delete_family":
{ Args: { "p_family_id": string }; Returns: undefined
                           },
"display_name":
{ Args: { "uid": string }; Returns: string
                           },
"email_verified":
{ Args: Record<PropertyKey, never>; Returns: boolean
                           },
"enqueue_event_reminders":
{ Args: { "p_now"?: string }; Returns: number
                           },
"enqueue_notification":
{ Args: { "p_body": string,"p_category"?: string,"p_data"?: Json,"p_dedupe"?: string,"p_family": string,"p_ignore_quiet"?: boolean,"p_silent"?: boolean,"p_title": string,"p_type": Database["public"]['Enums']["notification_type"],"p_user": string }; Returns: undefined
                           },
"event_occurrences":
{ Args: { "e": Database["public"]['Tables']["events"]['Row'],"from_ts": string,"to_ts": string }; Returns: string[]
                           },
"forget_devices":
{ Args: Record<PropertyKey, never>; Returns: undefined
                           },
"hourly_location_cleanup":
{ Args: Record<PropertyKey, never>; Returns: undefined
                           },
"in_quiet_hours":
{ Args: { "p_now"?: string,"uid": string }; Returns: boolean
                           },
"ingest_locations":
{ Args: { "p_battery"?: number,"p_points": Json }; Returns: number
                           },
"is_member":
{ Args: { "fid": string,"roles"?: (Database["public"]['Enums']["role_t"])[] }; Returns: boolean
                           },
"kick_push_sender":
{ Args: Record<PropertyKey, never>; Returns: undefined
                           },
"log_activity":
{ Args: { "entity_id": string,"entity_type": string,"fid": string,"summary": Json,"verb": string }; Returns: undefined
                           },
"minutely_notifications":
{ Args: Record<PropertyKey, never>; Returns: undefined
                           },
"my_family":
{ Args: Record<PropertyKey, never>; Returns: string
                           },
"nightly_cleanup":
{ Args: Record<PropertyKey, never>; Returns: undefined
                           },
"notifications_enabled":
{ Args: { "t": Database["public"]['Enums']["notification_type"],"uid": string }; Returns: boolean
                           },
"owner_count":
{ Args: { "fid": string }; Returns: number
                           },
"record_push_errors":
{ Args: { "p_error": string,"p_ids": (string)[] }; Returns: undefined
                           },
"register_push_token":
{ Args: { "p_device_name"?: string,"p_platform": Database["public"]['Enums']["device_platform"],"p_token": string }; Returns: undefined
                           },
"remove_member":
{ Args: { "p_family_id": string,"p_user_id": string }; Returns: undefined
                           },
"request_location":
{ Args: { "p_to": string }; Returns: undefined
                           },
"revoke_invite":
{ Args: { "p_invite_id": string }; Returns: undefined
                           },
"seed_family_lists":
{ Args: { "fid": string }; Returns: undefined
                           },
"set_location_sharing":
{ Args: { "p_mode": Database["public"]['Enums']["location_mode"],"p_paused_until"?: string }; Returns: {
              "allowed_by": string | null,
"family_id": string,
"mode": Database["public"]['Enums']["location_mode"],
"paused_until": string | null,
"updated_at": string,
"user_id": string
            }
                          SetofOptions: {
        from: "*"
        to: "location_settings"
        isOneToOne: true
        isSetofReturn: false
      } },
"set_member_role":
{ Args: { "p_family_id": string,"p_role": Database["public"]['Enums']["role_t"],"p_user_id": string }; Returns: undefined
                           },
"shares_family":
{ Args: { "uid": string }; Returns: boolean
                           },
"sharing_active":
{ Args: { "uid": string }; Returns: boolean
                           },
"suggest_items":
{ Args: { "p_family_id": string,"p_prefix": string }; Returns: {
              "category_id": string,"title": string
            }[]
                           }
          }
          Enums: {
            "device_platform": "ios"|"android"|"web","list_type": "shopping"|"todo","location_mode": "off"|"foreground"|"always","notification_type": "item_assigned"|"event_reminder"|"location_request"|"location_refresh"|"member_joined"|"list_changed","push_provider": "expo"|"webpush","role_t": "owner"|"adult"|"child"
          }
          CompositeTypes: {
            [_ in never]: never
          }
        }
}

type DatabaseWithoutInternals = Omit<Database, '__InternalSupabase'>

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
    : never = never
> = DefaultSchemaTableNameOrOptions extends { schema: keyof DatabaseWithoutInternals }
  ? (DatabaseWithoutInternals[DefaultSchemaTableNameOrOptions["schema"]]["Tables"] &
      DatabaseWithoutInternals[DefaultSchemaTableNameOrOptions["schema"]]["Views"])[TableName] extends {
      Row: infer R
    }
    ? R
    : never
  : DefaultSchemaTableNameOrOptions extends keyof (DefaultSchema["Tables"] & DefaultSchema["Views"])
  ? (DefaultSchema["Tables"] & DefaultSchema["Views"])[DefaultSchemaTableNameOrOptions] extends {
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
    : never = never
> = DefaultSchemaTableNameOrOptions extends { schema: keyof DatabaseWithoutInternals }
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
    : never = never
> = DefaultSchemaTableNameOrOptions extends { schema: keyof DatabaseWithoutInternals }
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
    : never = never
> = DefaultSchemaEnumNameOrOptions extends { schema: keyof DatabaseWithoutInternals }
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
    : never = never
> = PublicCompositeTypeNameOrOptions extends { schema: keyof DatabaseWithoutInternals }
  ? DatabaseWithoutInternals[PublicCompositeTypeNameOrOptions["schema"]]["CompositeTypes"][CompositeTypeName]
  : PublicCompositeTypeNameOrOptions extends keyof DefaultSchema["CompositeTypes"]
  ? DefaultSchema["CompositeTypes"][PublicCompositeTypeNameOrOptions]
  : never

export const Constants = {
  "graphql_public": {
          Enums: {
            
          }
        },"public": {
          Enums: {
            "device_platform": ["ios", "android", "web"],"list_type": ["shopping", "todo"],"location_mode": ["off", "foreground", "always"],"notification_type": ["item_assigned", "event_reminder", "location_request", "location_refresh", "member_joined", "list_changed"],"push_provider": ["expo", "webpush"],"role_t": ["owner", "adult", "child"]
          }
        }
} as const

