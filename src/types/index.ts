// src/types/index.ts

export interface Group {
  id: number;
  name: string;
  color: string;
  parent_id: number | null;
  view_mode: 'card' | 'list';
  sort_order: number;
  created_at: string;
  updated_at: string;
  serviceCount?: number;
}

export interface Service {
  id: number;
  group_id: number;
  name: string;
  url: string;
  username: string | null;
  password: string | null;
  description: string | null;
  icon: string | null;
  tags: string[] | null;
  accent_color: string | null;
  is_online: boolean;
  last_checked_at: string | null;
  sort_order: number;
  created_at: string;
  updated_at: string;
}

export interface ApiResponse<T> {
  success: boolean;
  data?: T;
  message?: string;
}

export interface ServiceAccount {
  id: number;
  service_id: number;
  name: string;
  username: string;
  password: string;
  is_default: boolean;
  sort_order: number;
  created_at: string;
  updated_at: string;
}