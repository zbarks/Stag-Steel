// ============================================================
//  middleware.js  - password gate for /portal and its API routes
//  (HTTP Basic Auth). The rest of the shop is untouched.
//
//  Set in Vercel -> Project -> Settings -> Environment Variables:
//    BASIC_AUTH_USER       e.g. stag
//    BASIC_AUTH_PASSWORD   your chosen password
//  If they are missing the portal stays locked (fails closed).
//  Designed by Barker Digital
// ============================================================
import { next } from '@vercel/edge';

export const config = {
  matcher: ['/portal', '/portal/(.*)', '/api/portal-(.*)'],
};

function safeEqual(a, b) {
  if (a.length !== b.length) return false;
  let diff = 0;
  for (let i = 0; i < a.length; i++) diff |= a.charCodeAt(i) ^ b.charCodeAt(i);
  return diff === 0;
}

export default function middleware(request) {
  const USER = process.env.BASIC_AUTH_USER;
  const PASS = process.env.BASIC_AUTH_PASSWORD;
  if (!USER || !PASS) return new Response('Auth not configured', { status: 503 });

  const header = request.headers.get('authorization') || '';
  if (header.startsWith('Basic ')) {
    let decoded = '';
    try { decoded = atob(header.slice(6)); } catch (e) { decoded = ''; }
    const i = decoded.indexOf(':');
    if (i !== -1 && safeEqual(decoded.slice(0, i), USER) && safeEqual(decoded.slice(i + 1), PASS)) {
      return next();
    }
  }
  return new Response('Authentication required', {
    status: 401,
    headers: { 'WWW-Authenticate': 'Basic realm="Stag & Steel Portal", charset="UTF-8"' },
  });
}
