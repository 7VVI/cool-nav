// src/types/index.ts

export interface Group {
  id: number;
  name: string;
  color: string;
  parent_id: number | null;
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
  sort_order: number;
  created_at: string;
  updated_at: string;
}

export interface ApiResponse<T> {
  success: boolean;
  data?: T;
  message?: string;
}