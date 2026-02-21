export interface TenantContext {
  tenantId: string;
  userId: string;
  role: string;
}

export interface SessionUser {
  id: string;
  email: string;
  name: string;
  tenantId: string;
  role: string;
}

export interface SafeUser {
  id: string;
  name: string;
  email: string;
  role: string;
  tenantId: string;
  createdAt: string;
}
