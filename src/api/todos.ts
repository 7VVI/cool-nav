// src/api/todos.ts
import request from './request';
import type { Todo, ApiResponse } from '@/types';

export const todosApi = {
  getAll: () => request.get<any, ApiResponse<Todo[]>>('/todos'),

  create: (data: Partial<Todo>) => request.post<any, ApiResponse<Todo>>('/todos', data),

  update: (id: number, data: Partial<Todo>) => request.put<any, ApiResponse<Todo>>(`/todos/${id}`, data),

  delete: (id: number) => request.delete<any, ApiResponse<void>>(`/todos/${id}`),
};
