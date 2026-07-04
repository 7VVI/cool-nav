// src/api/docs.ts
import request from './request';
import type { SharedDoc, SharedDocCreatePayload, ApiResponse } from '@/types';

export const docsApi = {
  list: () => request.get<any, ApiResponse<SharedDoc[]>>('/docs'),

  create: (data: SharedDocCreatePayload) =>
    request.post<any, ApiResponse<SharedDoc>>('/docs', data),

  update: (id: number, data: { name: string }) =>
    request.put<any, ApiResponse<{ id: number; name: string }>>(`/docs/${id}`, data),

  remove: (id: number) => request.delete<any, ApiResponse<void>>(`/docs/${id}`),

  reorder: (items: { id: number }[]) =>
    request.put<any, ApiResponse<void>>('/docs/reorder', { items }),

  download: async (id: number, filename: string) => {
    const res = await request.get(`/docs/${id}/download`, {
      responseType: 'blob',
    });
    // res is already a Blob because response interceptor returns response.data
    const blob = res as unknown as Blob;
    const url = window.URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = filename;
    document.body.appendChild(a);
    a.click();
    document.body.removeChild(a);
    window.URL.revokeObjectURL(url);
  },
};
