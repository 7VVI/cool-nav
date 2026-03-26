// src/api/request.ts
import axios from 'axios';
import { useAuthStore } from '@/stores/authStore';

const request = axios.create({
  baseURL: '/api',
  timeout: 10000
});

// 请求拦截器 - 添加 token
request.interceptors.request.use(
  config => {
    const authStore = useAuthStore();
    const token = authStore.token;
    if (token) {
      config.headers.Authorization = `Bearer ${token}`;
    }
    return config;
  },
  error => {
    return Promise.reject(error);
  }
);

// 响应拦截器 - 处理 401 错误
request.interceptors.response.use(
  response => response.data,
  error => {
    if (error.response?.status === 401) {
      const authStore = useAuthStore();
      authStore.logout();
      // 强制刷新页面跳转到登录
      window.location.reload();
    }
    console.error('API Error:', error);
    return Promise.reject(error);
  }
);

export default request;