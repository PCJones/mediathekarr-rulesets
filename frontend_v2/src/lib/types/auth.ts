/**
 * Auth Types
 * Role-based authentication types
 */

export type UserRole = 'admin' | 'user' | 'guest';

export interface AuthUser {
	email: string;
	role: UserRole;
	displayName?: string;
}
