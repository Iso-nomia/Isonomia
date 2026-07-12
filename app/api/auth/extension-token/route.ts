export const dynamic = "force-dynamic";

// ─────────────────────────────────────────────────────────────────────────────
// Token Exchange API route for the Chrome extension
//
// POST /api/auth/extension-token
//
// Accepts either:
//   { idToken }       — Validate a Firebase ID token and return user info
//   { refreshToken }  — Exchange a refresh token for a new ID token
//
// Returns: { ok, idToken, refreshToken, expiresIn, user }
// ─────────────────────────────────────────────────────────────────────────────

import { NextRequest, NextResponse } from "next/server";
import { getAdminAuth } from "@/lib/firebase/admin";
import { fetchUserByAuthId, createDefaultUser } from "@/lib/actions/user.actions";
import { firebaseConfig } from "@/lib/firebase/config";

interface TokenExchangeRequest {
  idToken?: string;
  refreshToken?: string;
}

interface TokenExchangeResponse {
  ok: boolean;
  idToken?: string;
  refreshToken?: string;
  expiresIn?: number;
  user?: {
    uid: string;
    displayName: string | null;
    email: string | null;
    userId: string;
    username: string | null;
  };
  error?: string;
}

export async function POST(req: NextRequest): Promise<NextResponse<TokenExchangeResponse>> {
  try {
    const body = (await req.json()) as TokenExchangeRequest;

    // ── Refresh token flow ──────────────────────────────────────────────
    if (body.refreshToken) {
      const refreshResult = await exchangeRefreshToken(body.refreshToken);
      if (!refreshResult) {
        return NextResponse.json(
          { ok: false, error: "Invalid refresh token" },
          { status: 401 }
        );
      }

      // Verify the new ID token and get user info
      const userInfo = await verifyAndGetUser(refreshResult.idToken);
      if (!userInfo) {
        return NextResponse.json(
          { ok: false, error: "Failed to verify refreshed token" },
          { status: 401 }
        );
      }

      return NextResponse.json({
        ok: true,
        idToken: refreshResult.idToken,
        refreshToken: refreshResult.refreshToken,
        expiresIn: refreshResult.expiresIn,
        user: userInfo,
      });
    }

    // ── ID token flow ───────────────────────────────────────────────────
    if (body.idToken) {
      const userInfo = await verifyAndGetUser(body.idToken);
      if (!userInfo) {
        return NextResponse.json(
          { ok: false, error: "Invalid ID token" },
          { status: 401 }
        );
      }

      return NextResponse.json({
        ok: true,
        idToken: body.idToken,
        user: userInfo,
      });
    }

    return NextResponse.json(
      { ok: false, error: "Provide either idToken or refreshToken" },
      { status: 400 }
    );
  } catch (err) {
    console.error("[extension-token] Error:", err);
    return NextResponse.json(
      { ok: false, error: "Internal server error" },
      { status: 500 }
    );
  }
}

// ─── Helpers ─────────────────────────────────────────────────────────────────

async function verifyAndGetUser(idToken: string) {
  try {
    const decoded = await getAdminAuth().verifyIdToken(idToken);

    let user = await fetchUserByAuthId(decoded.uid);
    if (!user) {
      user = await createDefaultUser({
        authId: decoded.uid,
        email: decoded.email,
        name: decoded.name ?? null,
        image: decoded.picture ?? null,
      });
    }

    return {
      uid: decoded.uid,
      displayName: decoded.name ?? null,
      email: decoded.email ?? null,
      userId: String(user.id),
      username: user.username ?? null,
    };
  } catch {
    return null;
  }
}

/**
 * Exchange a Firebase refresh token for a new ID token using the
 * Firebase Auth REST API (securetoken.googleapis.com).
 */
async function exchangeRefreshToken(refreshToken: string) {
  try {
    const res = await fetch(
      `https://securetoken.googleapis.com/v1/token?key=${firebaseConfig.apiKey}`,
      {
        method: "POST",
        headers: { "Content-Type": "application/x-www-form-urlencoded" },
        body: new URLSearchParams({
          grant_type: "refresh_token",
          refresh_token: refreshToken,
        }),
      }
    );

    if (!res.ok) return null;

    const data = await res.json();
    return {
      idToken: data.id_token as string,
      refreshToken: data.refresh_token as string,
      expiresIn: parseInt(data.expires_in, 10),
    };
  } catch {
    return null;
  }
}
