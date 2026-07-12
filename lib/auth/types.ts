// lib/auth/types.ts
export type User = {
    uid: string;
    email: string | null;
    displayName: string | null;
    photoURL: string | null;
    phoneNumber: string | null;
    emailVerified: boolean;
    providerId?: string | null;
    customClaims?: Record<string, unknown>;
    userId: string | number | bigint;   // your DB pk
    onboarded?: boolean;
    bio?: string | null;
    username?: string | null;
  };
  