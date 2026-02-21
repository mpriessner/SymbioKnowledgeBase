# SKB-02.1: User Registration and Login with NextAuth.js

**Epic:** EPIC-02 — Authentication & Multi-Tenancy
**Story ID:** SKB-02.1
**Story Points:** 5
**Priority:** Critical
**Status:** Draft
**Depends On:** SKB-01.2 (Prisma schema with `users` and `tenants` tables)

---

## User Story

**As a** researcher,
**I want to** register and log into my private workspace,
**So that** my knowledge base is secure and only accessible to me.

---

## Acceptance Criteria

- [ ] A user can register with name, email, and password via `POST /api/auth/register`
- [ ] Registration creates both a new `tenant` and a new `user` record in a single transaction
- [ ] Passwords are hashed with bcryptjs (cost factor 10) before storage
- [ ] Duplicate email registration returns 409 CONFLICT with descriptive error
- [ ] A registered user can log in via the NextAuth.js CredentialsProvider (email/password)
- [ ] Successful login returns a JWT stored in an HTTP-only cookie
- [ ] The JWT contains `userId`, `tenantId`, and `role` claims
- [ ] JWT sessions expire after 24 hours of inactivity
- [ ] The login page at `/(auth)/login` renders an email/password form with client-side validation
- [ ] The register page at `/(auth)/register` renders a name/email/password form with client-side validation
- [ ] Form validation errors display inline below each field
- [ ] Successful registration redirects to `/(auth)/login` with a success message
- [ ] Successful login redirects to `/(workspace)/pages`
- [ ] The Next.js middleware redirects unauthenticated users to `/login` for all `/(workspace)/*` routes
- [ ] The middleware allows unauthenticated access to `/(auth)/*` routes and `/api/auth/*` routes
- [ ] All API responses follow the standard envelope: `{ data, meta }` / `{ error, meta }`
- [ ] Password must be at least 8 characters (validated by Zod schema)
- [ ] Email must be a valid email format (validated by Zod schema)
- [ ] Name must be between 1 and 100 characters (validated by Zod schema)

---

## Architecture Overview

```
Browser                                          Server
  │                                                │
  │  POST /api/auth/register                       │
  │  { name, email, password }                     │
  │  ─────────────────────────────────────────────▶│
  │                                                │
  │                                    ┌───────────┴───────────┐
  │                                    │  Zod Validation       │
  │                                    │  ↓                    │
  │                                    │  bcrypt.hash(pw, 10)  │
  │                                    │  ↓                    │
  │                                    │  prisma.$transaction  │
  │                                    │    → create tenant    │
  │                                    │    → create user      │
  │                                    │  ↓                    │
  │                                    │  Return { data, meta }│
  │                                    └───────────┬───────────┘
  │  201 Created                                   │
  │  ◀─────────────────────────────────────────────│
  │                                                │
  │  POST /api/auth/callback/credentials           │
  │  { email, password }                           │
  │  ─────────────────────────────────────────────▶│
  │                                                │
  │                                    ┌───────────┴───────────┐
  │                                    │  NextAuth.js          │
  │                                    │  CredentialsProvider   │
  │                                    │  ↓                    │
  │                                    │  Lookup user by email │
  │                                    │  ↓                    │
  │                                    │  bcrypt.compare()     │
  │                                    │  ↓                    │
  │                                    │  Sign JWT             │
  │                                    │  { userId, tenantId,  │
  │                                    │    role }             │
  │                                    │  ↓                    │
  │                                    │  Set HTTP-only cookie │
  │                                    └───────────┬───────────┘
  │  Set-Cookie: next-auth.session-token=...       │
  │  ◀─────────────────────────────────────────────│
  │                                                │
  │  GET /(workspace)/pages                        │
  │  Cookie: next-auth.session-token=...           │
  │  ─────────────────────────────────────────────▶│
  │                                                │
  │                                    ┌───────────┴───────────┐
  │                                    │  middleware.ts         │
  │                                    │  ↓                    │
  │                                    │  Verify JWT from      │
  │                                    │  cookie               │
  │                                    │  ↓                    │
  │                                    │  Token valid?         │
  │                                    │  Yes → pass through   │
  │                                    │  No  → redirect       │
  │                                    │        /login          │
  │                                    └───────────┬───────────┘
  │                                                │
```

---

## Implementation Steps

### Step 1: Create Zod validation schemas

**File: `src/lib/validation/auth.ts`**

```typescript
import { z } from 'zod';

export const registerSchema = z.object({
  name: z
    .string()
    .min(1, 'Name is required')
    .max(100, 'Name must be 100 characters or less')
    .trim(),
  email: z
    .string()
    .email('Invalid email address')
    .max(255, 'Email must be 255 characters or less')
    .toLowerCase()
    .trim(),
  password: z
    .string()
    .min(8, 'Password must be at least 8 characters')
    .max(128, 'Password must be 128 characters or less'),
});

export const loginSchema = z.object({
  email: z
    .string()
    .email('Invalid email address')
    .toLowerCase()
    .trim(),
  password: z
    .string()
    .min(1, 'Password is required'),
});

export type RegisterInput = z.infer<typeof registerSchema>;
export type LoginInput = z.infer<typeof loginSchema>;
```

### Step 2: Create auth type definitions

**File: `src/types/auth.ts`**

```typescript
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
```

### Step 3: Create NextAuth.js configuration

**File: `src/lib/auth.ts`**

```typescript
import { NextAuthOptions } from 'next-auth';
import CredentialsProvider from 'next-auth/providers/credentials';
import bcrypt from 'bcryptjs';
import { prisma } from '@/lib/db';
import { loginSchema } from '@/lib/validation/auth';

export const authOptions: NextAuthOptions = {
  providers: [
    CredentialsProvider({
      name: 'credentials',
      credentials: {
        email: { label: 'Email', type: 'email' },
        password: { label: 'Password', type: 'password' },
      },
      async authorize(credentials) {
        const parsed = loginSchema.safeParse(credentials);
        if (!parsed.success) {
          return null;
        }

        const { email, password } = parsed.data;

        const user = await prisma.user.findUnique({
          where: { email },
        });

        if (!user) {
          return null;
        }

        const isPasswordValid = await bcrypt.compare(password, user.passwordHash);
        if (!isPasswordValid) {
          return null;
        }

        return {
          id: user.id,
          email: user.email,
          name: user.name,
          tenantId: user.tenantId,
          role: user.role,
        };
      },
    }),
  ],

  session: {
    strategy: 'jwt',
    maxAge: 24 * 60 * 60, // 24 hours
  },

  pages: {
    signIn: '/login',
    error: '/login',
  },

  callbacks: {
    async jwt({ token, user }) {
      if (user) {
        token.userId = user.id;
        token.tenantId = (user as { tenantId: string }).tenantId;
        token.role = (user as { role: string }).role;
      }
      return token;
    },

    async session({ session, token }) {
      if (session.user) {
        (session.user as { id: string }).id = token.userId as string;
        (session.user as { tenantId: string }).tenantId = token.tenantId as string;
        (session.user as { role: string }).role = token.role as string;
      }
      return session;
    },
  },

  secret: process.env.NEXTAUTH_SECRET,
};
```

### Step 4: Create NextAuth route handler

**File: `src/app/api/auth/[...nextauth]/route.ts`**

```typescript
import NextAuth from 'next-auth';
import { authOptions } from '@/lib/auth';

const handler = NextAuth(authOptions);

export { handler as GET, handler as POST };
```

### Step 5: Create NextAuth type augmentation

**File: `src/types/next-auth.d.ts`**

```typescript
import 'next-auth';
import 'next-auth/jwt';

declare module 'next-auth' {
  interface Session {
    user: {
      id: string;
      email: string;
      name: string;
      tenantId: string;
      role: string;
    };
  }

  interface User {
    id: string;
    email: string;
    name: string;
    tenantId: string;
    role: string;
  }
}

declare module 'next-auth/jwt' {
  interface JWT {
    userId: string;
    tenantId: string;
    role: string;
  }
}
```

### Step 6: Create registration API endpoint

**File: `src/app/api/auth/register/route.ts`**

```typescript
import { NextRequest, NextResponse } from 'next/server';
import bcrypt from 'bcryptjs';
import { prisma } from '@/lib/db';
import { registerSchema } from '@/lib/validation/auth';

export async function POST(request: NextRequest) {
  try {
    const body = await request.json();

    const parsed = registerSchema.safeParse(body);
    if (!parsed.success) {
      return NextResponse.json(
        {
          error: {
            code: 'VALIDATION_ERROR',
            message: 'Invalid registration data',
            details: parsed.error.issues.map((issue) => ({
              field: issue.path.join('.'),
              message: issue.message,
            })),
          },
          meta: { timestamp: new Date().toISOString() },
        },
        { status: 400 }
      );
    }

    const { name, email, password } = parsed.data;

    // Check for existing user
    const existingUser = await prisma.user.findUnique({
      where: { email },
    });

    if (existingUser) {
      return NextResponse.json(
        {
          error: {
            code: 'CONFLICT',
            message: 'A user with this email already exists',
          },
          meta: { timestamp: new Date().toISOString() },
        },
        { status: 409 }
      );
    }

    // Hash password with bcrypt cost factor 10
    const passwordHash = await bcrypt.hash(password, 10);

    // Create tenant and user in a transaction
    const result = await prisma.$transaction(async (tx) => {
      const tenant = await tx.tenant.create({
        data: {
          name: `${name}'s Workspace`,
        },
      });

      const user = await tx.user.create({
        data: {
          name,
          email,
          passwordHash,
          role: 'USER',
          tenantId: tenant.id,
        },
      });

      return {
        user: {
          id: user.id,
          name: user.name,
          email: user.email,
          role: user.role,
          tenantId: tenant.id,
          createdAt: user.createdAt.toISOString(),
        },
      };
    });

    return NextResponse.json(
      {
        data: result.user,
        meta: { timestamp: new Date().toISOString() },
      },
      { status: 201 }
    );
  } catch (error) {
    console.error('Registration error:', error);
    return NextResponse.json(
      {
        error: {
          code: 'INTERNAL_ERROR',
          message: 'An unexpected error occurred during registration',
        },
        meta: { timestamp: new Date().toISOString() },
      },
      { status: 500 }
    );
  }
}
```

### Step 7: Create Next.js middleware for protected routes

**File: `src/middleware.ts`**

```typescript
import { NextResponse } from 'next/server';
import type { NextRequest } from 'next/server';
import { getToken } from 'next-auth/jwt';

// Routes that do not require authentication
const PUBLIC_PATHS = [
  '/login',
  '/register',
  '/api/auth',
];

function isPublicPath(pathname: string): boolean {
  return PUBLIC_PATHS.some((path) => pathname.startsWith(path));
}

export async function middleware(request: NextRequest) {
  const { pathname } = request.nextUrl;

  // Allow public paths and static assets
  if (
    isPublicPath(pathname) ||
    pathname.startsWith('/_next') ||
    pathname.startsWith('/favicon') ||
    pathname.includes('.')
  ) {
    return NextResponse.next();
  }

  // Check for valid JWT token
  const token = await getToken({
    req: request,
    secret: process.env.NEXTAUTH_SECRET,
  });

  // Redirect to login if not authenticated
  if (!token) {
    const loginUrl = new URL('/login', request.url);
    loginUrl.searchParams.set('callbackUrl', pathname);
    return NextResponse.redirect(loginUrl);
  }

  return NextResponse.next();
}

export const config = {
  matcher: [
    /*
     * Match all request paths except:
     * - _next/static (static files)
     * - _next/image (image optimization)
     * - favicon.ico (favicon)
     */
    '/((?!_next/static|_next/image|favicon.ico).*)',
  ],
};
```

### Step 8: Create Login page

**File: `src/app/(auth)/login/page.tsx`**

```tsx
'use client';

import { useState } from 'react';
import { signIn } from 'next-auth/react';
import { useRouter, useSearchParams } from 'next/navigation';
import Link from 'next/link';
import { loginSchema } from '@/lib/validation/auth';
import type { z } from 'zod';

type FieldErrors = Partial<Record<string, string>>;

export default function LoginPage() {
  const router = useRouter();
  const searchParams = useSearchParams();
  const callbackUrl = searchParams.get('callbackUrl') || '/pages';
  const registered = searchParams.get('registered');

  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [errors, setErrors] = useState<FieldErrors>({});
  const [generalError, setGeneralError] = useState('');
  const [isLoading, setIsLoading] = useState(false);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setErrors({});
    setGeneralError('');

    // Client-side validation
    const parsed = loginSchema.safeParse({ email, password });
    if (!parsed.success) {
      const fieldErrors: FieldErrors = {};
      parsed.error.issues.forEach((issue) => {
        const field = issue.path[0] as string;
        fieldErrors[field] = issue.message;
      });
      setErrors(fieldErrors);
      return;
    }

    setIsLoading(true);

    try {
      const result = await signIn('credentials', {
        email: parsed.data.email,
        password: parsed.data.password,
        redirect: false,
      });

      if (result?.error) {
        setGeneralError('Invalid email or password');
      } else {
        router.push(callbackUrl);
        router.refresh();
      }
    } catch {
      setGeneralError('An unexpected error occurred. Please try again.');
    } finally {
      setIsLoading(false);
    }
  };

  return (
    <div className="flex min-h-screen items-center justify-center bg-gray-50 dark:bg-gray-900 px-4">
      <div className="w-full max-w-md space-y-8">
        <div className="text-center">
          <h1 className="text-3xl font-bold tracking-tight text-gray-900 dark:text-white">
            Sign in to SymbioKnowledgeBase
          </h1>
          <p className="mt-2 text-sm text-gray-600 dark:text-gray-400">
            Access your private knowledge workspace
          </p>
        </div>

        {registered && (
          <div className="rounded-md bg-green-50 dark:bg-green-900/20 p-4">
            <p className="text-sm text-green-800 dark:text-green-400">
              Registration successful. Please sign in with your credentials.
            </p>
          </div>
        )}

        {generalError && (
          <div className="rounded-md bg-red-50 dark:bg-red-900/20 p-4">
            <p className="text-sm text-red-800 dark:text-red-400">
              {generalError}
            </p>
          </div>
        )}

        <form onSubmit={handleSubmit} className="mt-8 space-y-6">
          <div className="space-y-4">
            <div>
              <label
                htmlFor="email"
                className="block text-sm font-medium text-gray-700 dark:text-gray-300"
              >
                Email address
              </label>
              <input
                id="email"
                name="email"
                type="email"
                autoComplete="email"
                required
                value={email}
                onChange={(e) => setEmail(e.target.value)}
                className="mt-1 block w-full rounded-md border border-gray-300 px-3 py-2
                  text-gray-900 placeholder-gray-400 shadow-sm
                  focus:border-blue-500 focus:outline-none focus:ring-1 focus:ring-blue-500
                  dark:border-gray-600 dark:bg-gray-800 dark:text-white
                  dark:placeholder-gray-500 dark:focus:border-blue-400
                  dark:focus:ring-blue-400"
                placeholder="you@example.com"
              />
              {errors.email && (
                <p className="mt-1 text-sm text-red-600 dark:text-red-400">
                  {errors.email}
                </p>
              )}
            </div>

            <div>
              <label
                htmlFor="password"
                className="block text-sm font-medium text-gray-700 dark:text-gray-300"
              >
                Password
              </label>
              <input
                id="password"
                name="password"
                type="password"
                autoComplete="current-password"
                required
                value={password}
                onChange={(e) => setPassword(e.target.value)}
                className="mt-1 block w-full rounded-md border border-gray-300 px-3 py-2
                  text-gray-900 placeholder-gray-400 shadow-sm
                  focus:border-blue-500 focus:outline-none focus:ring-1 focus:ring-blue-500
                  dark:border-gray-600 dark:bg-gray-800 dark:text-white
                  dark:placeholder-gray-500 dark:focus:border-blue-400
                  dark:focus:ring-blue-400"
                placeholder="Enter your password"
              />
              {errors.password && (
                <p className="mt-1 text-sm text-red-600 dark:text-red-400">
                  {errors.password}
                </p>
              )}
            </div>
          </div>

          <button
            type="submit"
            disabled={isLoading}
            className="flex w-full justify-center rounded-md bg-blue-600 px-4 py-2
              text-sm font-semibold text-white shadow-sm
              hover:bg-blue-500 focus:outline-none focus:ring-2
              focus:ring-blue-500 focus:ring-offset-2
              disabled:cursor-not-allowed disabled:opacity-50
              dark:focus:ring-offset-gray-900"
          >
            {isLoading ? 'Signing in...' : 'Sign in'}
          </button>

          <p className="text-center text-sm text-gray-600 dark:text-gray-400">
            Don&apos;t have an account?{' '}
            <Link
              href="/register"
              className="font-medium text-blue-600 hover:text-blue-500 dark:text-blue-400"
            >
              Register here
            </Link>
          </p>
        </form>
      </div>
    </div>
  );
}
```

### Step 9: Create Register page

**File: `src/app/(auth)/register/page.tsx`**

```tsx
'use client';

import { useState } from 'react';
import { useRouter } from 'next/navigation';
import Link from 'next/link';
import { registerSchema } from '@/lib/validation/auth';

type FieldErrors = Partial<Record<string, string>>;

export default function RegisterPage() {
  const router = useRouter();

  const [name, setName] = useState('');
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [errors, setErrors] = useState<FieldErrors>({});
  const [generalError, setGeneralError] = useState('');
  const [isLoading, setIsLoading] = useState(false);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setErrors({});
    setGeneralError('');

    // Client-side validation
    const parsed = registerSchema.safeParse({ name, email, password });
    if (!parsed.success) {
      const fieldErrors: FieldErrors = {};
      parsed.error.issues.forEach((issue) => {
        const field = issue.path[0] as string;
        fieldErrors[field] = issue.message;
      });
      setErrors(fieldErrors);
      return;
    }

    setIsLoading(true);

    try {
      const response = await fetch('/api/auth/register', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(parsed.data),
      });

      const result = await response.json();

      if (!response.ok) {
        if (response.status === 409) {
          setGeneralError('A user with this email already exists.');
        } else if (result.error?.details) {
          const fieldErrors: FieldErrors = {};
          result.error.details.forEach(
            (detail: { field: string; message: string }) => {
              fieldErrors[detail.field] = detail.message;
            }
          );
          setErrors(fieldErrors);
        } else {
          setGeneralError(
            result.error?.message || 'Registration failed. Please try again.'
          );
        }
        return;
      }

      // Redirect to login with success message
      router.push('/login?registered=true');
    } catch {
      setGeneralError('An unexpected error occurred. Please try again.');
    } finally {
      setIsLoading(false);
    }
  };

  return (
    <div className="flex min-h-screen items-center justify-center bg-gray-50 dark:bg-gray-900 px-4">
      <div className="w-full max-w-md space-y-8">
        <div className="text-center">
          <h1 className="text-3xl font-bold tracking-tight text-gray-900 dark:text-white">
            Create your account
          </h1>
          <p className="mt-2 text-sm text-gray-600 dark:text-gray-400">
            Start building your AI-powered knowledge base
          </p>
        </div>

        {generalError && (
          <div className="rounded-md bg-red-50 dark:bg-red-900/20 p-4">
            <p className="text-sm text-red-800 dark:text-red-400">
              {generalError}
            </p>
          </div>
        )}

        <form onSubmit={handleSubmit} className="mt-8 space-y-6">
          <div className="space-y-4">
            <div>
              <label
                htmlFor="name"
                className="block text-sm font-medium text-gray-700 dark:text-gray-300"
              >
                Full name
              </label>
              <input
                id="name"
                name="name"
                type="text"
                autoComplete="name"
                required
                value={name}
                onChange={(e) => setName(e.target.value)}
                className="mt-1 block w-full rounded-md border border-gray-300 px-3 py-2
                  text-gray-900 placeholder-gray-400 shadow-sm
                  focus:border-blue-500 focus:outline-none focus:ring-1 focus:ring-blue-500
                  dark:border-gray-600 dark:bg-gray-800 dark:text-white
                  dark:placeholder-gray-500 dark:focus:border-blue-400
                  dark:focus:ring-blue-400"
                placeholder="Dr. Lisa Chen"
              />
              {errors.name && (
                <p className="mt-1 text-sm text-red-600 dark:text-red-400">
                  {errors.name}
                </p>
              )}
            </div>

            <div>
              <label
                htmlFor="email"
                className="block text-sm font-medium text-gray-700 dark:text-gray-300"
              >
                Email address
              </label>
              <input
                id="email"
                name="email"
                type="email"
                autoComplete="email"
                required
                value={email}
                onChange={(e) => setEmail(e.target.value)}
                className="mt-1 block w-full rounded-md border border-gray-300 px-3 py-2
                  text-gray-900 placeholder-gray-400 shadow-sm
                  focus:border-blue-500 focus:outline-none focus:ring-1 focus:ring-blue-500
                  dark:border-gray-600 dark:bg-gray-800 dark:text-white
                  dark:placeholder-gray-500 dark:focus:border-blue-400
                  dark:focus:ring-blue-400"
                placeholder="you@example.com"
              />
              {errors.email && (
                <p className="mt-1 text-sm text-red-600 dark:text-red-400">
                  {errors.email}
                </p>
              )}
            </div>

            <div>
              <label
                htmlFor="password"
                className="block text-sm font-medium text-gray-700 dark:text-gray-300"
              >
                Password
              </label>
              <input
                id="password"
                name="password"
                type="password"
                autoComplete="new-password"
                required
                value={password}
                onChange={(e) => setPassword(e.target.value)}
                className="mt-1 block w-full rounded-md border border-gray-300 px-3 py-2
                  text-gray-900 placeholder-gray-400 shadow-sm
                  focus:border-blue-500 focus:outline-none focus:ring-1 focus:ring-blue-500
                  dark:border-gray-600 dark:bg-gray-800 dark:text-white
                  dark:placeholder-gray-500 dark:focus:border-blue-400
                  dark:focus:ring-blue-400"
                placeholder="Minimum 8 characters"
              />
              {errors.password && (
                <p className="mt-1 text-sm text-red-600 dark:text-red-400">
                  {errors.password}
                </p>
              )}
            </div>
          </div>

          <button
            type="submit"
            disabled={isLoading}
            className="flex w-full justify-center rounded-md bg-blue-600 px-4 py-2
              text-sm font-semibold text-white shadow-sm
              hover:bg-blue-500 focus:outline-none focus:ring-2
              focus:ring-blue-500 focus:ring-offset-2
              disabled:cursor-not-allowed disabled:opacity-50
              dark:focus:ring-offset-gray-900"
          >
            {isLoading ? 'Creating account...' : 'Create account'}
          </button>

          <p className="text-center text-sm text-gray-600 dark:text-gray-400">
            Already have an account?{' '}
            <Link
              href="/login"
              className="font-medium text-blue-600 hover:text-blue-500 dark:text-blue-400"
            >
              Sign in
            </Link>
          </p>
        </form>
      </div>
    </div>
  );
}
```

### Step 10: Update `.env.example` with auth variables

**File: `.env.example` (add to existing)**

```bash
# --- Authentication (NextAuth.js) ---
NEXTAUTH_SECRET=your-secret-key-here-generate-with-openssl-rand-base64-32
NEXTAUTH_URL=http://localhost:3000
```

---

## Testing Requirements

### Unit Tests

**File: `tests/unit/auth/validation.test.ts`**

```typescript
import { describe, it, expect } from 'vitest';
import { registerSchema, loginSchema } from '@/lib/validation/auth';

describe('registerSchema', () => {
  it('accepts valid registration data', () => {
    const result = registerSchema.safeParse({
      name: 'Dr. Lisa Chen',
      email: 'lisa@example.com',
      password: 'securepassword123',
    });
    expect(result.success).toBe(true);
  });

  it('trims and lowercases email', () => {
    const result = registerSchema.safeParse({
      name: 'Lisa',
      email: '  LISA@Example.COM  ',
      password: 'securepassword123',
    });
    expect(result.success).toBe(true);
    if (result.success) {
      expect(result.data.email).toBe('lisa@example.com');
    }
  });

  it('rejects empty name', () => {
    const result = registerSchema.safeParse({
      name: '',
      email: 'lisa@example.com',
      password: 'securepassword123',
    });
    expect(result.success).toBe(false);
  });

  it('rejects name longer than 100 characters', () => {
    const result = registerSchema.safeParse({
      name: 'A'.repeat(101),
      email: 'lisa@example.com',
      password: 'securepassword123',
    });
    expect(result.success).toBe(false);
  });

  it('rejects invalid email format', () => {
    const result = registerSchema.safeParse({
      name: 'Lisa',
      email: 'not-an-email',
      password: 'securepassword123',
    });
    expect(result.success).toBe(false);
  });

  it('rejects password shorter than 8 characters', () => {
    const result = registerSchema.safeParse({
      name: 'Lisa',
      email: 'lisa@example.com',
      password: '1234567',
    });
    expect(result.success).toBe(false);
  });

  it('rejects password longer than 128 characters', () => {
    const result = registerSchema.safeParse({
      name: 'Lisa',
      email: 'lisa@example.com',
      password: 'A'.repeat(129),
    });
    expect(result.success).toBe(false);
  });
});

describe('loginSchema', () => {
  it('accepts valid login data', () => {
    const result = loginSchema.safeParse({
      email: 'lisa@example.com',
      password: 'securepassword123',
    });
    expect(result.success).toBe(true);
  });

  it('rejects empty password', () => {
    const result = loginSchema.safeParse({
      email: 'lisa@example.com',
      password: '',
    });
    expect(result.success).toBe(false);
  });

  it('rejects invalid email', () => {
    const result = loginSchema.safeParse({
      email: 'invalid',
      password: 'securepassword123',
    });
    expect(result.success).toBe(false);
  });
});
```

**File: `tests/unit/auth/password.test.ts`**

```typescript
import { describe, it, expect } from 'vitest';
import bcrypt from 'bcryptjs';

describe('Password hashing', () => {
  it('hashes and verifies password correctly', async () => {
    const password = 'securepassword123';
    const hash = await bcrypt.hash(password, 10);

    expect(hash).not.toBe(password);
    expect(hash.length).toBeGreaterThan(50);

    const isValid = await bcrypt.compare(password, hash);
    expect(isValid).toBe(true);
  });

  it('rejects incorrect password', async () => {
    const password = 'securepassword123';
    const hash = await bcrypt.hash(password, 10);

    const isValid = await bcrypt.compare('wrongpassword', hash);
    expect(isValid).toBe(false);
  });

  it('uses cost factor 10', async () => {
    const hash = await bcrypt.hash('test', 10);
    // bcrypt hash format: $2a$<cost>$<salt+hash>
    expect(hash).toMatch(/^\$2[aby]\$10\$/);
  });
});
```

### Integration Tests

**File: `tests/api/auth.test.ts`**

```typescript
import { describe, it, expect, beforeAll, afterAll } from 'vitest';
import { prisma } from '@/lib/db';

const BASE_URL = process.env.TEST_BASE_URL || 'http://localhost:3000';

describe('POST /api/auth/register', () => {
  afterAll(async () => {
    // Clean up test users
    await prisma.user.deleteMany({
      where: { email: { startsWith: 'test-auth-' } },
    });
    await prisma.tenant.deleteMany({
      where: { name: { startsWith: 'test-auth-' } },
    });
  });

  it('creates a new user and tenant', async () => {
    const response = await fetch(`${BASE_URL}/api/auth/register`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        name: 'test-auth-user',
        email: 'test-auth-register@example.com',
        password: 'securepassword123',
      }),
    });

    expect(response.status).toBe(201);

    const body = await response.json();
    expect(body.data).toBeDefined();
    expect(body.data.id).toBeDefined();
    expect(body.data.email).toBe('test-auth-register@example.com');
    expect(body.data.name).toBe('test-auth-user');
    expect(body.data.role).toBe('USER');
    expect(body.data.tenantId).toBeDefined();
    expect(body.meta.timestamp).toBeDefined();

    // Verify password is NOT in the response
    expect(body.data.password).toBeUndefined();
    expect(body.data.passwordHash).toBeUndefined();
  });

  it('returns 409 for duplicate email', async () => {
    // Register first
    await fetch(`${BASE_URL}/api/auth/register`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        name: 'test-auth-dup',
        email: 'test-auth-duplicate@example.com',
        password: 'securepassword123',
      }),
    });

    // Try to register again with the same email
    const response = await fetch(`${BASE_URL}/api/auth/register`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        name: 'test-auth-dup-2',
        email: 'test-auth-duplicate@example.com',
        password: 'anotherpassword123',
      }),
    });

    expect(response.status).toBe(409);
    const body = await response.json();
    expect(body.error.code).toBe('CONFLICT');
  });

  it('returns 400 for invalid input', async () => {
    const response = await fetch(`${BASE_URL}/api/auth/register`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        name: '',
        email: 'not-an-email',
        password: 'short',
      }),
    });

    expect(response.status).toBe(400);
    const body = await response.json();
    expect(body.error.code).toBe('VALIDATION_ERROR');
    expect(body.error.details).toBeDefined();
    expect(body.error.details.length).toBeGreaterThan(0);
  });

  it('stores password as bcrypt hash, not plaintext', async () => {
    await fetch(`${BASE_URL}/api/auth/register`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        name: 'test-auth-hash',
        email: 'test-auth-hashcheck@example.com',
        password: 'securepassword123',
      }),
    });

    const user = await prisma.user.findUnique({
      where: { email: 'test-auth-hashcheck@example.com' },
    });

    expect(user).toBeDefined();
    expect(user!.passwordHash).not.toBe('securepassword123');
    expect(user!.passwordHash).toMatch(/^\$2[aby]\$10\$/);
  });
});

describe('POST /api/auth/callback/credentials (login)', () => {
  beforeAll(async () => {
    // Register a user for login tests
    await fetch(`${BASE_URL}/api/auth/register`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        name: 'test-auth-login',
        email: 'test-auth-login@example.com',
        password: 'securepassword123',
      }),
    });
  });

  it('returns a session token on valid credentials', async () => {
    const response = await fetch(
      `${BASE_URL}/api/auth/callback/credentials`,
      {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          email: 'test-auth-login@example.com',
          password: 'securepassword123',
        }),
        redirect: 'manual',
      }
    );

    // NextAuth redirects on success
    const setCookie = response.headers.get('set-cookie');
    expect(
      setCookie?.includes('next-auth.session-token') ||
        setCookie?.includes('__Secure-next-auth.session-token')
    ).toBe(true);
  });

  it('rejects invalid password', async () => {
    const response = await fetch(
      `${BASE_URL}/api/auth/callback/credentials`,
      {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          email: 'test-auth-login@example.com',
          password: 'wrongpassword',
        }),
        redirect: 'manual',
      }
    );

    // NextAuth redirects to error page on failure
    const location = response.headers.get('location');
    expect(location).toContain('error');
  });

  it('rejects non-existent email', async () => {
    const response = await fetch(
      `${BASE_URL}/api/auth/callback/credentials`,
      {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          email: 'nonexistent@example.com',
          password: 'securepassword123',
        }),
        redirect: 'manual',
      }
    );

    const location = response.headers.get('location');
    expect(location).toContain('error');
  });
});

describe('Middleware: protected routes', () => {
  it('redirects unauthenticated users to /login', async () => {
    const response = await fetch(`${BASE_URL}/pages`, {
      redirect: 'manual',
    });

    expect(response.status).toBe(307);
    const location = response.headers.get('location');
    expect(location).toContain('/login');
  });

  it('allows access to /login without authentication', async () => {
    const response = await fetch(`${BASE_URL}/login`);
    expect(response.status).toBe(200);
  });

  it('allows access to /register without authentication', async () => {
    const response = await fetch(`${BASE_URL}/register`);
    expect(response.status).toBe(200);
  });

  it('allows access to /api/auth endpoints without authentication', async () => {
    const response = await fetch(`${BASE_URL}/api/auth/providers`);
    expect(response.status).toBe(200);
  });
});
```

---

## Files to Create/Modify

| Action | File Path | Description |
|--------|-----------|-------------|
| Create | `src/lib/validation/auth.ts` | Zod schemas for register and login input |
| Create | `src/types/auth.ts` | Auth-related TypeScript type definitions |
| Create | `src/types/next-auth.d.ts` | NextAuth.js type augmentation for session |
| Create | `src/lib/auth.ts` | NextAuth.js configuration with CredentialsProvider |
| Create | `src/app/api/auth/[...nextauth]/route.ts` | NextAuth.js route handler |
| Create | `src/app/api/auth/register/route.ts` | Registration API endpoint |
| Create | `src/middleware.ts` | Next.js middleware for protected routes |
| Modify | `src/app/(auth)/login/page.tsx` | Replace placeholder with login form |
| Modify | `src/app/(auth)/register/page.tsx` | Replace placeholder with registration form |
| Modify | `.env.example` | Add NEXTAUTH_SECRET and NEXTAUTH_URL |
| Create | `tests/unit/auth/validation.test.ts` | Unit tests for Zod validation schemas |
| Create | `tests/unit/auth/password.test.ts` | Unit tests for bcrypt password hashing |
| Create | `tests/api/auth.test.ts` | Integration tests for auth endpoints |

---

**Last Updated:** 2026-02-21
