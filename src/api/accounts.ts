// src/api/accounts.ts
import request from './request';
import type { ServiceAccount } from '@/types';

export const accountsApi = {
  list(serviceId: number) {
    return request.get<any, { success: boolean; data: ServiceAccount[] }>(`/services/${serviceId}/accounts`);
  },

  create(serviceId: number, data: Partial<ServiceAccount>) {
    return request.post<any, { success: boolean; data: ServiceAccount }>(`/services/${serviceId}/accounts`, data);
  },

  update(serviceId: number, id: number, data: Partial<ServiceAccount>) {
    return request.put<any, { success: boolean; data: ServiceAccount }>(`/services/${serviceId}/accounts/${id}`, data);
  },

  delete(serviceId: number, id: number) {
    return request.delete<any, { success: boolean }>(`/services/${serviceId}/accounts/${id}`);
  },

  setDefault(serviceId: number, id: number) {
    return request.put<any, { success: boolean }>(`/services/${serviceId}/accounts/${id}/default`);
  }
};
