// src/stores/todoStore.ts
import { defineStore } from 'pinia';
import { ref } from 'vue';
import { todosApi } from '@/api/todos';
import type { Todo } from '@/types';

export const useTodoStore = defineStore('todos', () => {
  const todos = ref<Todo[]>([]);
  const loading = ref(false);

  async function fetchTodos() {
    loading.value = true;
    try {
      const res = await todosApi.getAll();
      todos.value = res.data || [];
    } catch (e) {
      console.error('Failed to fetch todos:', e);
    } finally {
      loading.value = false;
    }
  }

  async function addTodo(data: Partial<Todo>) {
    const res = await todosApi.create(data);
    if (res.data) {
      todos.value.push(res.data);
    }
    return res.data;
  }

  async function updateTodo(id: number, data: Partial<Todo>) {
    const res = await todosApi.update(id, data);
    if (res.data) {
      const index = todos.value.findIndex(t => t.id === id);
      if (index > -1) {
        todos.value[index] = { ...todos.value[index], ...res.data };
      }
    }
    return res.data;
  }

  async function deleteTodo(id: number) {
    await todosApi.delete(id);
    todos.value = todos.value.filter(t => t.id !== id);
  }

  async function moveTodo(id: number, newStatus: Todo['status']) {
    return updateTodo(id, { status: newStatus });
  }

  return { todos, loading, fetchTodos, addTodo, updateTodo, deleteTodo, moveTodo };
});
