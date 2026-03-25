/** @type {import('tailwindcss').Config} */
export default {
  content: [
    './index.html',
    './src/**/*.{vue,js,ts,jsx,tsx}'
  ],
  theme: {
    extend: {
      colors: {
        primary: '#3b82f6',
        'bg-main': '#f8fafc',
        'text-main': '#1e293b',
        'text-sub': '#64748b',
        'border-main': '#e2e8f0'
      }
    }
  },
  plugins: []
};