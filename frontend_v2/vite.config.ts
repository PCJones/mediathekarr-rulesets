import { sveltekit } from '@sveltejs/kit/vite';
import { defineConfig } from 'vitest/config';

export default defineConfig({
	plugins: [sveltekit()],
	server: {
		port: 5173,
		strictPort: false,
		host: '127.0.0.1'
	},
	test: {
		include: ['src/**/*.test.ts']
	}
});
