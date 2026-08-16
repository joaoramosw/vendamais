import { createServerClient } from '@supabase/ssr'
import { NextResponse, type NextRequest } from 'next/server'
import { landingPathForRole } from '@/lib/routes'
import type { RoleKey } from '@/lib/types/database'

// ─────────────────────────────────────────────────────────────────────────────
// Constants
// ─────────────────────────────────────────────────────────────────────────────

const AUTH_PAGES = ['/login', '/cadastro'] as const

// ─────────────────────────────────────────────────────────────────────────────
// Pure helpers (no I/O)
// ─────────────────────────────────────────────────────────────────────────────

function isAuthPage(pathname: string): boolean {
  return AUTH_PAGES.some((p) => pathname.startsWith(p))
}

/**
 * Compara por **segmento inteiro**, não por prefixo de texto.
 *
 * `startsWith('/fornecedor')` casava também com `/fornecedores` — a landing
 * pública de fornecedores — e mandava todo visitante deslogado dessa página
 * para o /login (confirmado ao vivo: respondia 307 → /login). Prefixo cru volta
 * a criar esse problema a cada rota nova que comece com o mesmo texto.
 */
function isRouteGroup(pathname: string, base: string): boolean {
  return pathname === base || pathname.startsWith(`${base}/`)
}

function isEmpresarioRoute(pathname: string): boolean {
  return isRouteGroup(pathname, '/empresario')
}

function isFornecedorRoute(pathname: string): boolean {
  return isRouteGroup(pathname, '/fornecedor')
}

function isProtectedRoute(pathname: string): boolean {
  return isEmpresarioRoute(pathname) || isFornecedorRoute(pathname)
}

function redirectTo(request: NextRequest, path: string): NextResponse {
  const url = request.nextUrl.clone()
  url.pathname = path
  return NextResponse.redirect(url)
}

// ─────────────────────────────────────────────────────────────────────────────
// Main middleware
// ─────────────────────────────────────────────────────────────────────────────

export async function updateSession(request: NextRequest): Promise<NextResponse> {
  let supabaseResponse = NextResponse.next({ request })

  // ── 1. Initialise Supabase with cookie passthrough ──
  const supabase = createServerClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!,
    {
      cookies: {
        getAll() {
          return request.cookies.getAll()
        },
        setAll(cookiesToSet) {
          cookiesToSet.forEach(({ name, value }) => request.cookies.set(name, value))
          supabaseResponse = NextResponse.next({ request })
          cookiesToSet.forEach(({ name, value, options }) =>
            supabaseResponse.cookies.set(name, value, options)
          )
        },
      },
    }
  )

  // ── 2. Refresh session ──
  const {
    data: { user },
  } = await supabase.auth.getUser()

  const pathname = request.nextUrl.pathname

  // ── 3. Unauthenticated → redirect to /login ──
  if (isProtectedRoute(pathname) && !user) {
    return redirectTo(request, '/login')
  }

  // ── 4. Authenticated user visiting an auth page (/login etc.) ──
  // Role is only resolved here — this is a rare path (not the dashboard
  // navigation hot path), so the extra query doesn't affect perceived speed.
  // The cross-domain guard and impersonation header used to live here too,
  // but both became redundant once (dashboard)/layout.tsx started doing the
  // same checks for free (it already has `role` from the cached
  // getCurrentUser() call) — removing them here cuts a Supabase round-trip
  // from every dashboard navigation.
  if (user && isAuthPage(pathname)) {
    const { data: userRow } = await supabase
      .from('users')
      .select('roles(key)')
      .eq('id', user.id)
      .maybeSingle()

    const roleKey = (userRow as unknown as { roles: { key: string } | null })?.roles?.key
    const role: RoleKey = roleKey === 'admin' ? 'admin' : 'supplier'

    // Fornecedor cai em "Cotações Ativas" (o Dashboard dele está desativado —
    // ver src/lib/routes.ts).
    return redirectTo(request, landingPathForRole(role))
  }

  return supabaseResponse
}
