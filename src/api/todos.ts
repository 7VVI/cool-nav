// src/api/todos.ts
import request from './request';
import type { Todo } from '@/types';

export const todosApi = {
  getAll: () => request.get<never, { success: boolean; data: Todo[] }>('/todos'),

  create: (data: Partial<Todo>) => request.post<never, { success: boolean; data: Todo }>('/todos', data),

  update: (id: number, data: Partial<Todo>) => request.put<never, { success: boolean; data: Todo }>(`/todos/${id}`, data),

  delete: (id: number) => request.delete<never, { success: boolean }>(`/todos/${id}`),

  batchUpdate: (items: { id: number; status: string; sort_order: number }[]) =>
    request.put<never, { success: boolean }>('/todos', { items }),
};
