// src/api/docs.ts
import request from './request';
import type { SharedDoc, SharedDocCreatePayload, ApiResponse } from '@/types';

export const docsApi = {
  list: () => request.get<any, ApiResponse<SharedDoc[]>>('/docs'),

  create: (data: SharedDocCreatePayload) =>
    request.post<any, ApiResponse<SharedDoc>>('/docs', data),

  remove: (id: number) => request.delete<any, ApiResponse<void>>(`/docs/${id}`),
};
