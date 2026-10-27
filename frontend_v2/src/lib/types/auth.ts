/**
 * Auth Types
 * Role-based authentication types
 */

export type UserRole = 'admin' | 'user' | 'guest';

export interface AuthUser {
	id: number;
	email: string;
	username?: string;
	role: UserRole;
	displayName?: string;
}
