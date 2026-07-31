// Hand-maintained to mirror supabase/migrations/*.sql exactly.
// If you have the Supabase CLI installed, you can instead generate this with:
//   supabase gen types typescript --project-id <ref> > src/lib/database.types.ts
// and it will produce an equivalent (superset) shape.

export type Json = string | number | boolean | null | { [key: string]: Json | undefined } | Json[];

export interface Database {
  public: {
    Tables: {
      tenants: {
        Row: {
          id: string;
          name: string;
          is_demo: boolean;
          created_at: string;
          updated_at: string;
        };
        Insert: Partial<Database['public']['Tables']['tenants']['Row']> & { name: string };
        Update: Partial<Database['public']['Tables']['tenants']['Row']>;
      };
      app_users: {
        Row: {
          id: string;
          tenant_id: string;
          display_name: string;
          role: 'host' | 'operator';
          created_at: string;
        };
        Insert: Partial<Database['public']['Tables']['app_users']['Row']> & {
          id: string;
          tenant_id: string;
          display_name: string;
        };
        Update: Partial<Database['public']['Tables']['app_users']['Row']>;
      };
      relationship_types: {
        Row: {
          id: string;
          tenant_id: string;
          label: string;
          sort_order: number;
          is_system: boolean;
          created_at: string;
        };
        Insert: Partial<Database['public']['Tables']['relationship_types']['Row']> & {
          tenant_id: string;
          label: string;
        };
        Update: Partial<Database['public']['Tables']['relationship_types']['Row']>;
      };
      event_types: {
        Row: {
          id: string;
          tenant_id: string;
          label: string;
          sort_order: number;
          is_system: boolean;
          created_at: string;
        };
        Insert: Partial<Database['public']['Tables']['event_types']['Row']> & {
          tenant_id: string;
          label: string;
        };
        Update: Partial<Database['public']['Tables']['event_types']['Row']>;
      };
      people: {
        Row: {
          id: string;
          tenant_id: string;
          first_name: string;
          last_name: string;
          preferred_name: string | null;
          email: string | null;
          email_normalized: string | null;
          company: string | null;
          title: string | null;
          relationship_type_id: string | null;
          contact_preference: 'email_ok' | 'phone_only' | 'do_not_contact';
          is_active: boolean;
          summary_note: string | null;
          created_at: string;
          updated_at: string;
        };
        Insert: Partial<Database['public']['Tables']['people']['Row']> & {
          tenant_id: string;
          first_name: string;
          last_name: string;
        };
        Update: Partial<Database['public']['Tables']['people']['Row']>;
      };
      events: {
        Row: {
          id: string;
          tenant_id: string;
          internal_name: string;
          public_title: string;
          event_type_id: string | null;
          purpose: string | null;
          audience_description: string | null;
          value_proposition: string | null;
          speaker_details: string | null;
          starts_at: string | null;
          ends_at: string | null;
          time_zone: string;
          is_virtual: boolean;
          venue_name: string | null;
          venue_address: string | null;
          parking_notes: string | null;
          virtual_link: string | null;
          capacity: number | null;
          rsvp_deadline: string | null;
          status: 'draft' | 'inviting' | 'closed' | 'completed' | 'cancelled';
          created_at: string;
          updated_at: string;
        };
        Insert: Partial<Database['public']['Tables']['events']['Row']> & {
          tenant_id: string;
          internal_name: string;
          public_title: string;
        };
        Update: Partial<Database['public']['Tables']['events']['Row']>;
      };
      invitations: {
        Row: {
          id: string;
          tenant_id: string;
          event_id: string;
          person_id: string;
          public_token: string;
          audience_segment: 'priority' | 'member' | 'prospect' | 'guest' | 'referral' | 'other';
          personalization_note: string | null;
          invite_status: 'planned' | 'ready' | 'sent' | 'held' | 'bounced' | 'withdrawn';
          rsvp_status: 'no_response' | 'yes' | 'no' | 'maybe' | 'waitlisted' | 'cancelled';
          rsvp_responded_at: string | null;
          guest_count: number;
          guest_names: string | null;
          dietary_accessibility_notes: string | null;
          attendance_status: 'unknown' | 'attended' | 'no_show' | 'cancelled';
          reminders_sent: Json;
          calculated_next_action: string | null;
          next_action_overridden_by_host: boolean;
          host_override_status: string | null;
          created_at: string;
          updated_at: string;
        };
        Insert: Partial<Database['public']['Tables']['invitations']['Row']> & {
          tenant_id: string;
          event_id: string;
          person_id: string;
        };
        Update: Partial<Database['public']['Tables']['invitations']['Row']>;
      };
      notes: {
        Row: {
          id: string;
          tenant_id: string;
          person_id: string | null;
          event_id: string | null;
          invitation_id: string | null;
          body: string;
          created_by: string | null;
          created_at: string;
        };
        Insert: Partial<Database['public']['Tables']['notes']['Row']> & {
          tenant_id: string;
          body: string;
        };
        Update: Partial<Database['public']['Tables']['notes']['Row']>;
      };
      messages: {
        Row: {
          id: string;
          tenant_id: string;
          event_id: string;
          message_type:
            | 'invitation'
            | 'reminder'
            | 'priority_follow_up'
            | 'rsvp_confirmation'
            | 'final_details'
            | 'waitlist'
            | 'cancellation'
            | 'thank_you'
            | 'post_event_follow_up'
            | 'form_intro'
            | 'form_confirmation';
          subject: string | null;
          body: string;
          is_approved: boolean;
          approved_at: string | null;
          approved_by: string | null;
          created_at: string;
          updated_at: string;
        };
        Insert: Partial<Database['public']['Tables']['messages']['Row']> & {
          tenant_id: string;
          event_id: string;
          message_type: Database['public']['Tables']['messages']['Row']['message_type'];
        };
        Update: Partial<Database['public']['Tables']['messages']['Row']>;
      };
      message_variants: {
        Row: {
          id: string;
          tenant_id: string;
          message_id: string;
          variant_index: number;
          subject: string;
          body: string;
          is_active: boolean;
          generated_by_ai: boolean;
          created_at: string;
          updated_at: string;
        };
        Insert: Partial<Database['public']['Tables']['message_variants']['Row']> & {
          tenant_id: string;
          message_id: string;
          variant_index: number;
          subject: string;
          body: string;
        };
        Update: Partial<Database['public']['Tables']['message_variants']['Row']>;
      };
      forms: {
        Row: {
          id: string;
          tenant_id: string;
          event_id: string;
          public_token: string;
          intro_text: string | null;
          confirmation_text: string | null;
          is_published: boolean;
          published_at: string | null;
          theme: Json | null;
          created_at: string;
          updated_at: string;
        };
        Insert: Partial<Database['public']['Tables']['forms']['Row']> & {
          tenant_id: string;
          event_id: string;
        };
        Update: Partial<Database['public']['Tables']['forms']['Row']>;
      };
      form_questions: {
        Row: {
          id: string;
          tenant_id: string;
          form_id: string;
          question_type:
            | 'attendance'
            | 'guest_count'
            | 'guest_names'
            | 'dietary_accessibility'
            | 'open_text'
            | 'short_text'
            | 'yes_no';
          label: string;
          help_text: string | null;
          is_required: boolean;
          sort_order: number;
          options: Json;
          created_at: string;
          updated_at: string;
        };
        Insert: Partial<Database['public']['Tables']['form_questions']['Row']> & {
          tenant_id: string;
          form_id: string;
          question_type: Database['public']['Tables']['form_questions']['Row']['question_type'];
          label: string;
        };
        Update: Partial<Database['public']['Tables']['form_questions']['Row']>;
      };
      form_responses: {
        Row: {
          id: string;
          tenant_id: string;
          form_id: string;
          invitation_id: string | null;
          raw_answers: Json;
          submitted_email: string | null;
          submitted_name: string | null;
          submitted_at: string;
          ip_hash: string | null;
          match_status: 'matched' | 'needs_review' | 'manual_entry';
          resolved_invitation_id: string | null;
          resolved_at: string | null;
          resolved_by: string | null;
          created_at: string;
        };
        Insert: Partial<Database['public']['Tables']['form_responses']['Row']> & {
          tenant_id: string;
          form_id: string;
          raw_answers: Json;
        };
        Update: Partial<Database['public']['Tables']['form_responses']['Row']>;
      };
      mailbox_connections: {
        Row: {
          id: string;
          tenant_id: string;
          provider: 'microsoft';
          connected_email: string | null;
          encrypted_refresh_token: string | null;
          access_token_expires_at: string | null;
          status: 'disconnected' | 'connected' | 'needs_reconnect' | 'throttled';
          last_error: string | null;
          last_checked_at: string | null;
          created_at: string;
          updated_at: string;
        };
        Insert: Partial<Database['public']['Tables']['mailbox_connections']['Row']> & {
          tenant_id: string;
        };
        Update: Partial<Database['public']['Tables']['mailbox_connections']['Row']>;
      };
      tenant_settings: {
        Row: {
          tenant_id: string;
          variant_threshold: number;
          variant_count_min: number;
          variant_count_max: number;
          branding: Json;
          host_display_name: string | null;
          host_signature: string | null;
          updated_at: string;
        };
        Insert: Partial<Database['public']['Tables']['tenant_settings']['Row']> & {
          tenant_id: string;
        };
        Update: Partial<Database['public']['Tables']['tenant_settings']['Row']>;
      };
      send_jobs: {
        Row: {
          id: string;
          tenant_id: string;
          event_id: string;
          message_id: string;
          job_type:
            | 'invitation'
            | 'reminder'
            | 'priority_follow_up'
            | 'rsvp_confirmation'
            | 'final_details'
            | 'waitlist'
            | 'cancellation'
            | 'thank_you'
            | 'post_event_follow_up';
          pace_profile: 'fastest' | 'one_day' | 'two_day' | 'custom';
          starts_at: string;
          estimated_finish_at: string | null;
          status: 'queued' | 'running' | 'paused' | 'completed' | 'cancelled' | 'failed';
          total_recipients: number;
          sent_count: number;
          failed_count: number;
          is_simulated: boolean;
          created_by: string | null;
          created_at: string;
          updated_at: string;
        };
        Insert: Partial<Database['public']['Tables']['send_jobs']['Row']> & {
          tenant_id: string;
          event_id: string;
          message_id: string;
          pace_profile: Database['public']['Tables']['send_jobs']['Row']['pace_profile'];
        };
        Update: Partial<Database['public']['Tables']['send_jobs']['Row']>;
      };
      send_job_recipients: {
        Row: {
          id: string;
          tenant_id: string;
          send_job_id: string;
          invitation_id: string;
          message_variant_id: string | null;
          resolved_subject: string;
          resolved_body: string;
          scheduled_at: string;
          sent_at: string | null;
          status: 'queued' | 'sent' | 'failed' | 'cancelled';
          attempt_count: number;
          last_error: string | null;
          provider_message_id: string | null;
          created_at: string;
          updated_at: string;
        };
        Insert: Partial<Database['public']['Tables']['send_job_recipients']['Row']> & {
          tenant_id: string;
          send_job_id: string;
          invitation_id: string;
          resolved_subject: string;
          resolved_body: string;
          scheduled_at: string;
        };
        Update: Partial<Database['public']['Tables']['send_job_recipients']['Row']>;
      };
      engagement_signals: {
        Row: {
          id: string;
          tenant_id: string;
          invitation_id: string;
          signal_type: 'email_opened' | 'form_link_clicked' | 'form_started' | 'form_submitted';
          occurred_at: string;
          meta: Json;
          created_at: string;
        };
        Insert: Partial<Database['public']['Tables']['engagement_signals']['Row']> & {
          tenant_id: string;
          invitation_id: string;
          signal_type: Database['public']['Tables']['engagement_signals']['Row']['signal_type'];
        };
        Update: Partial<Database['public']['Tables']['engagement_signals']['Row']>;
      };
    };
    Views: Record<string, never>;
    Functions: {
      current_tenant_id: {
        Args: Record<string, never>;
        Returns: string;
      };
    };
    Enums: Record<string, never>;
  };
}
