// src/api/tags.ts
import request from './request';
import type { ApiResponse } from '@/types';

export interface Tag {
  id: number;
  name: string;
  value: string;
  color: string;
  sort_order: number;
  created_at: string;
}

export const tagsApi = {
  getAll: () => request.get<any, ApiResponse<Tag[]>>('/tags'),

  create: (data: Partial<Tag>) => request.post<any, ApiResponse<Tag>>('/tags', data),

  update: (id: number, data: Partial<Tag>) => request.put<any, ApiResponse<Tag>>(`/tags/${id}`, data),

  delete: (id: number) => request.delete<any, ApiResponse<void>>(`/tags/${id}`)
};