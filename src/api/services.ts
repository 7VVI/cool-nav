// src/api/services.ts
import request from './request';
import type { Service, ApiResponse } from '@/types';

export const servicesApi = {
  getAll: (groupId?: number) => request.get<any, ApiResponse<Service[]>>('/services', { params: { group_id: groupId } }),

  search: (keyword: string) => request.get<any, ApiResponse<Service[]>>('/services', { params: { search: keyword } }),

  getById: (id: number) => request.get<any, ApiResponse<Service>>(`/services/${id}`),

  create: (data: Partial<Service>) => request.post<any, ApiResponse<Service>>('/services', data),

  update: (id: number, data: Partial<Service>) => request.put<any, ApiResponse<Service>>(`/services/${id}`, data),

  delete: (id: number) => request.delete<any, ApiResponse<void>>(`/services/${id}`),

  reorder: (items: { id: number; group_id: number }[]) => request.put<any, ApiResponse<void>>('/services/reorder', { items }),

  copyCredentials: (id: number) => request.post<any, ApiResponse<{ hasCredentials: boolean; username?: string; password?: string }>>(`/services/${id}/copy`)
};