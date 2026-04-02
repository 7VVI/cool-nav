// src/api/groups.ts
import request from './request';
import type { Group, ApiResponse } from '@/types';

export const groupsApi = {
  getAll: () => request.get<any, ApiResponse<Group[]>>('/groups'),

  getById: (id: number) => request.get<any, ApiResponse<Group>>(`/groups/${id}`),

  create: (data: Partial<Group>) => request.post<any, ApiResponse<Group>>('/groups', data),

  update: (id: number, data: Partial<Group>) => request.put<any, ApiResponse<Group>>(`/groups/${id}`, data),

  delete: (id: number) => request.delete<any, ApiResponse<void>>(`/groups/${id}`),

  reorder: (items: { id: number }[]) => request.put<any, ApiResponse<void>>('/groups/reorder', { items }),

  updateViewMode: (id: number, viewMode: 'card' | 'list') => request.put<any, ApiResponse<Group>>(`/groups/${id}/view-mode`, { view_mode: viewMode })
};