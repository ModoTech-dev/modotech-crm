export type Role =
  | 'SUPER_ADMIN' | 'ADMIN' | 'MANAGER' | 'AGENT' | 'SUPPORT' | 'SALES' | 'FINANCE' | 'VIEWER'

export interface User {
  id: string
  email: string
  first_name: string
  last_name: string
  full_name: string
  phone: string
  role: Role
  department: string
  is_active: boolean
  is_online: boolean
}

export interface Tag {
  id: string
  name: string
  color: string
}

export interface Customer {
  id: string
  whatsapp_number: string
  whatsapp_number_masked?: boolean
  name: string
  email: string
  phone: string
  location: string
  account_number: string
  isp_customer_id: string
  status: 'LEAD' | 'ACTIVE' | 'SUSPENDED' | 'INACTIVE' | 'PROSPECT'
  lead_outcome?: 'PENDING' | 'SUCCESSFUL' | 'REJECTED'
  payment_receipt_number?: string
  payment_amount?: string | null
  payment_confirmed_at?: string | null
  payment_confirmed_by_name?: string | null
  tags: Tag[]
  notes: string
  last_contact_at: string | null
  open_conversation_count: number
}

export type ConversationStatus = 'OPEN' | 'PENDING' | 'RESOLVED' | 'CLOSED'
export type Priority = 'LOW' | 'NORMAL' | 'HIGH' | 'URGENT'

export interface ConversationListItem {
  id: string
  customer: string
  customer_name: string
  customer_whatsapp_number: string
  customer_whatsapp_number_masked?: boolean
  assigned_agent: string | null
  assigned_agent_name: string | null
  department: string
  status: ConversationStatus
  priority: Priority
  tags: Tag[]
  last_message_at: string | null
  last_message_preview: string
  unread_count: number
}

export interface ConversationDetail {
  id: string
  customer: Customer
  assigned_agent: User | null
  department: string
  status: ConversationStatus
  priority: Priority
  subject: string
  tags: Tag[]
  last_message_at: string | null
  unread_count: number
  service_window_expires_at: string | null
}

export type SenderType = 'CUSTOMER' | 'AGENT' | 'SYSTEM' | 'BOT' | 'PHONE'

export interface Message {
  id: string
  conversation: string
  sender_type: SenderType
  sender_user: string | null
  sender_user_name: string | null
  message_type: string
  content: string
  media_path: string
  media_url?: string | null
  media_mime_type?: string
  metadata?: {
    latitude?: number
    longitude?: number
    name?: string
    address?: string
    [key: string]: unknown
  }
  status: 'RECEIVED' | 'SENT' | 'DELIVERED' | 'READ' | 'FAILED'
  timestamp: string
  is_deleted?: boolean
  deleted_at?: string | null
  deleted_by_name?: string | null
}

export interface OrgDashboardStats {
  scope: 'org'
  total_customers: number
  new_leads: number
  open_conversations: number
  pending_conversations: number
  resolved_conversations: number
  unassigned_conversations: number
  active_agents: number
  todays_incoming_messages: number
  todays_outgoing_messages: number
}

export interface PersonalDashboardStats {
  scope: 'personal'
  my_open_conversations: number
  my_pending_conversations: number
  my_resolved_conversations: number
  my_unread_conversations: number
  my_messages_sent_today: number
}

export type DashboardStats = OrgDashboardStats | PersonalDashboardStats

export interface AgentPerformance {
  agent_id: string
  name: string
  conversations_handled: number
  messages_sent: number
  open_conversations: number
  resolved_conversations: number
  leads_successful: number
  leads_pending: number
  leads_rejected: number
}

export interface RoutingRule {
  id: string
  keyword: string
  department: string
  is_active: boolean
  priority: number
}

export interface MessageTemplate {
  id: string
  name: string
  category: string
  language: string
  body: string
  status: 'DRAFT' | 'PENDING' | 'APPROVED' | 'REJECTED'
}

export interface DepartmentRecord {
  id: string
  name: string
  code: string
  is_active: boolean
}

export interface ISPAccount {
  account_number: string
  package: string
  speed_mbps: number
  monthly_price: number
  status: string
  balance: number
  last_payment_date: string | null
  next_expiry_date: string | null
  installation_date: string | null
  service_location: string
}

export interface Broadcast {
  id: string
  name: string
  template: string
  template_name: string
  customer_status_filter: string
  tag_filter: string | null
  status: 'DRAFT' | 'SENDING' | 'COMPLETED' | 'FAILED'
  sent_count: number
  failed_count: number
  error: string
  recipient_count: number
  created_at: string
}

export interface PhoneCheckResult {
  valid: boolean
  formatted?: string
  country?: string
  note?: string
  reason?: string
}
