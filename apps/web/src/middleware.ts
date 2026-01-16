import { NextResponse } from 'next/server';
import type { NextRequest } from 'next/server';

// In-memory rate limit store (use Redis in production)
const rateLimitStore = new Map<string, { count: number; resetTime: number }>();

// Rate limit configuration
const RATE_LIMIT_WINDOW_MS = 60 * 1000; // 1 minute
const MAX_REQUESTS_PER_WINDOW = 60; // 60 requests per minute
const API_MAX_REQUESTS = 30; // Stricter limit for API routes

// Suspicious patterns for input validation
const SUSPICIOUS_PATTERNS = [
  /<script/i,
  /javascript:/i,
  /on\w+=/i, // Event handlers
  /data:/i,
  /vbscript:/i,
  /expression\s*\(/i,
  /-moz-binding/i,
  /base64/i,
  /&#/i, // HTML entities
  /%3c/i, // Encoded <
  /%3e/i, // Encoded >
];

/**
 * Get client IP address from request
 */
function getClientIP(request: NextRequest): string {
  const forwarded = request.headers.get('x-forwarded-for');
  const realIP = request.headers.get('x-real-ip');

  if (forwarded) {
    return forwarded.split(',')[0].trim();
  }
  if (realIP) {
    return realIP;
  }
  return 'unknown';
}

/**
 * Check rate limit for a given key
 */
function checkRateLimit(key: string, maxRequests: number): { allowed: boolean; remaining: number; resetIn: number } {
  const now = Date.now();
  const record = rateLimitStore.get(key);

  // Clean up expired entries periodically
  if (rateLimitStore.size > 10000) {
    const entries = Array.from(rateLimitStore.entries());
    for (const [k, v] of entries) {
      if (v.resetTime < now) {
        rateLimitStore.delete(k);
      }
    }
  }

  if (!record || record.resetTime < now) {
    rateLimitStore.set(key, { count: 1, resetTime: now + RATE_LIMIT_WINDOW_MS });
    return { allowed: true, remaining: maxRequests - 1, resetIn: RATE_LIMIT_WINDOW_MS };
  }

  if (record.count >= maxRequests) {
    return { allowed: false, remaining: 0, resetIn: record.resetTime - now };
  }

  record.count++;
  return { allowed: true, remaining: maxRequests - record.count, resetIn: record.resetTime - now };
}

/**
 * Validate input for suspicious patterns (XSS prevention)
 */
function hasSuspiciousInput(value: string): boolean {
  return SUSPICIOUS_PATTERNS.some(pattern => pattern.test(value));
}

/**
 * Check URL parameters for malicious content
 */
function validateSearchParams(searchParams: URLSearchParams): boolean {
  const entries = Array.from(searchParams.entries());
  for (const [key, value] of entries) {
    if (hasSuspiciousInput(key) || hasSuspiciousInput(value)) {
      return false;
    }
  }
  return true;
}

/**
 * Validate request headers for suspicious content
 */
function validateHeaders(headers: Headers): boolean {
  const sensitiveHeaders = ['user-agent', 'referer', 'origin'];
  for (const header of sensitiveHeaders) {
    const value = headers.get(header);
    if (value && hasSuspiciousInput(value)) {
      return false;
    }
  }
  return true;
}

export function middleware(request: NextRequest) {
  const { pathname, searchParams } = request.nextUrl;
  const clientIP = getClientIP(request);
  const isApiRoute = pathname.startsWith('/api');

  // Skip middleware for static files
  if (
    pathname.startsWith('/_next') ||
    pathname.startsWith('/circuits') ||
    pathname.includes('.') // Static files
  ) {
    return NextResponse.next();
  }

  // Validate search parameters for XSS
  if (!validateSearchParams(searchParams)) {
    console.warn(`[Security] Suspicious query params from ${clientIP}: ${searchParams.toString()}`);
    return new NextResponse('Bad Request', { status: 400 });
  }

  // Validate headers
  if (!validateHeaders(request.headers)) {
    console.warn(`[Security] Suspicious headers from ${clientIP}`);
    return new NextResponse('Bad Request', { status: 400 });
  }

  // Apply rate limiting
  const rateLimitKey = `${clientIP}:${isApiRoute ? 'api' : 'page'}`;
  const maxRequests = isApiRoute ? API_MAX_REQUESTS : MAX_REQUESTS_PER_WINDOW;
  const { allowed, remaining, resetIn } = checkRateLimit(rateLimitKey, maxRequests);

  // Create response
  const response = allowed
    ? NextResponse.next()
    : new NextResponse('Too Many Requests', { status: 429 });

  // Add rate limit headers
  response.headers.set('X-RateLimit-Limit', maxRequests.toString());
  response.headers.set('X-RateLimit-Remaining', remaining.toString());
  response.headers.set('X-RateLimit-Reset', Math.ceil(resetIn / 1000).toString());

  if (!allowed) {
    console.warn(`[RateLimit] IP ${clientIP} exceeded limit on ${pathname}`);
    response.headers.set('Retry-After', Math.ceil(resetIn / 1000).toString());
  }

  // Add request ID for tracing
  const requestId = crypto.randomUUID();
  response.headers.set('X-Request-ID', requestId);

  return response;
}

// Configure which routes use this middleware
export const config = {
  matcher: [
    /*
     * Match all request paths except:
     * - _next/static (static files)
     * - _next/image (image optimization files)
     * - favicon.ico (favicon file)
     * - public folder files
     */
    '/((?!_next/static|_next/image|favicon.ico|circuits/).*)',
  ],
};
