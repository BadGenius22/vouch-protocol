import { NextResponse } from 'next/server';

/**
 * Health check endpoint for monitoring and deployment verification
 * GET /api/health
 */
export async function GET() {
  const startTime = Date.now();

  const health = {
    status: 'healthy',
    timestamp: new Date().toISOString(),
    version: process.env.npm_package_version || '0.1.0',
    environment: process.env.NEXT_PUBLIC_SOLANA_NETWORK || 'unknown',
    uptime: process.uptime(),
    checks: {
      app: 'ok',
      memory: getMemoryStatus(),
    },
    responseTime: 0,
  };

  // Check if critical environment variables are set
  const requiredEnvVars = [
    'NEXT_PUBLIC_SOLANA_NETWORK',
    'NEXT_PUBLIC_SOLANA_RPC_URL',
  ];

  const missingEnvVars = requiredEnvVars.filter(
    (v) => !process.env[v]
  );

  if (missingEnvVars.length > 0) {
    health.status = 'degraded';
    health.checks.app = `missing env: ${missingEnvVars.join(', ')}`;
  }

  health.responseTime = Date.now() - startTime;

  const statusCode = health.status === 'healthy' ? 200 : 503;

  return NextResponse.json(health, { status: statusCode });
}

function getMemoryStatus(): string {
  if (typeof process.memoryUsage !== 'function') {
    return 'unknown';
  }

  const used = process.memoryUsage();
  const heapUsedMB = Math.round(used.heapUsed / 1024 / 1024);
  const heapTotalMB = Math.round(used.heapTotal / 1024 / 1024);
  const percentage = Math.round((used.heapUsed / used.heapTotal) * 100);

  if (percentage > 90) {
    return `critical (${heapUsedMB}/${heapTotalMB}MB - ${percentage}%)`;
  } else if (percentage > 75) {
    return `warning (${heapUsedMB}/${heapTotalMB}MB - ${percentage}%)`;
  }

  return `ok (${heapUsedMB}/${heapTotalMB}MB - ${percentage}%)`;
}
