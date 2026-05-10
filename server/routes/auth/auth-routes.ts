import type { FastifyInstance } from 'fastify';
import {
	handleRegister,
	handleLogin,
	handleLogout,
} from './auth-controller.js';

export async function authRoutes(app: FastifyInstance) {
	app.post('/auth/register', handleRegister);
	app.post('/auth/login', handleLogin);
	app.post('/auth/logout', handleLogout);
}
