/**
 * Vouch Protocol - Monitoring Utilities
 *
 * Lightweight monitoring for error tracking, metrics, and logging.
 * Can be extended to integrate with external services (Datadog, etc.)
 */

type LogLevel = 'debug' | 'info' | 'warn' | 'error';

interface MetricData {
  name: string;
  value: number;
  tags?: Record<string, string>;
  timestamp: number;
}

interface ErrorData {
  error: Error;
  context?: Record<string, unknown>;
  tags?: Record<string, string>;
  timestamp: number;
}

// In-memory metrics buffer (for batch sending)
const metricsBuffer: MetricData[] = [];
const errorsBuffer: ErrorData[] = [];

// Configuration
const config = {
  enabled: process.env.NEXT_PUBLIC_ENABLE_ANALYTICS === 'true',
  debug: process.env.NEXT_PUBLIC_ENABLE_DEBUG === 'true',
  batchSize: 100,
  flushInterval: 30000, // 30 seconds
};

/**
 * Logger with structured output
 */
export const logger = {
  debug: (message: string, data?: Record<string, unknown>) => {
    if (config.debug) {
      log('debug', message, data);
    }
  },

  info: (message: string, data?: Record<string, unknown>) => {
    log('info', message, data);
  },

  warn: (message: string, data?: Record<string, unknown>) => {
    log('warn', message, data);
  },

  error: (message: string, error?: Error, data?: Record<string, unknown>) => {
    log('error', message, { ...data, error: error?.message, stack: error?.stack });
    if (error) {
      captureError(error, data);
    }
  },
};

function log(level: LogLevel, message: string, data?: Record<string, unknown>) {
  const timestamp = new Date().toISOString();
  const logData = {
    timestamp,
    level,
    message,
    ...data,
  };

  if (typeof window === 'undefined') {
    // Server-side: structured JSON logging
    console.log(JSON.stringify(logData));
  } else {
    // Client-side: readable console output
    const prefix = `[${timestamp}] [${level.toUpperCase()}]`;
    switch (level) {
      case 'debug':
        console.debug(prefix, message, data || '');
        break;
      case 'info':
        console.info(prefix, message, data || '');
        break;
      case 'warn':
        console.warn(prefix, message, data || '');
        break;
      case 'error':
        console.error(prefix, message, data || '');
        break;
    }
  }
}

/**
 * Track a metric
 */
export function trackMetric(
  name: string,
  value: number,
  tags?: Record<string, string>
) {
  if (!config.enabled) return;

  const metric: MetricData = {
    name,
    value,
    tags,
    timestamp: Date.now(),
  };

  metricsBuffer.push(metric);

  // Flush if buffer is full
  if (metricsBuffer.length >= config.batchSize) {
    flushMetrics();
  }
}

/**
 * Track timing (duration)
 */
export function trackTiming(
  name: string,
  durationMs: number,
  tags?: Record<string, string>
) {
  trackMetric(`${name}.duration`, durationMs, tags);
}

/**
 * Create a timer for measuring duration
 */
export function startTimer(name: string, tags?: Record<string, string>) {
  const startTime = performance.now();

  return {
    stop: () => {
      const duration = performance.now() - startTime;
      trackTiming(name, duration, tags);
      return duration;
    },
  };
}

/**
 * Capture an error
 */
export function captureError(
  error: Error,
  context?: Record<string, unknown>,
  tags?: Record<string, string>
) {
  if (!config.enabled) return;

  const errorData: ErrorData = {
    error,
    context,
    tags,
    timestamp: Date.now(),
  };

  errorsBuffer.push(errorData);

  // Immediately flush errors
  flushErrors();
}

/**
 * Wrap an async function with error tracking
 */
export function withErrorTracking<T extends (...args: unknown[]) => Promise<unknown>>(
  fn: T,
  context?: Record<string, unknown>
): T {
  return (async (...args: Parameters<T>) => {
    try {
      return await fn(...args);
    } catch (error) {
      if (error instanceof Error) {
        captureError(error, { ...context, args });
      }
      throw error;
    }
  }) as T;
}

/**
 * Flush metrics to external service
 */
async function flushMetrics() {
  if (metricsBuffer.length === 0) return;

  const metrics = [...metricsBuffer];
  metricsBuffer.length = 0;

  // In production, send to monitoring service
  // For now, just log in debug mode
  if (config.debug) {
    logger.debug('Flushing metrics', { count: metrics.length });
  }

  // TODO: Send to Datadog/Grafana/custom endpoint
  // await fetch('/api/metrics', {
  //   method: 'POST',
  //   body: JSON.stringify({ metrics }),
  // });
}

/**
 * Flush errors to external service
 */
async function flushErrors() {
  if (errorsBuffer.length === 0) return;

  const errors = [...errorsBuffer];
  errorsBuffer.length = 0;

  // In production, send to error tracking service
  // For now, just log
  for (const err of errors) {
    logger.debug('Captured error', {
      message: err.error.message,
      context: err.context,
    });
  }

  // TODO: Send to error tracking service
  // await fetch('/api/errors', {
  //   method: 'POST',
  //   body: JSON.stringify({ errors }),
  // });
}

// Periodic flush
if (typeof window !== 'undefined') {
  setInterval(() => {
    flushMetrics();
    flushErrors();
  }, config.flushInterval);
}

// Flush on page unload
if (typeof window !== 'undefined') {
  window.addEventListener('beforeunload', () => {
    flushMetrics();
    flushErrors();
  });
}

/**
 * Pre-defined metrics for Vouch Protocol
 */
export const metrics = {
  proofGeneration: {
    start: () => startTimer('proof.generation'),
    success: (proofType: string, durationMs: number) => {
      trackTiming('proof.generation', durationMs, { proofType, status: 'success' });
      trackMetric('proof.generation.count', 1, { proofType, status: 'success' });
    },
    failure: (proofType: string, error: string) => {
      trackMetric('proof.generation.count', 1, { proofType, status: 'failure', error });
    },
  },

  verification: {
    start: () => startTimer('proof.verification'),
    success: (proofType: string, durationMs: number) => {
      trackTiming('proof.verification', durationMs, { proofType, status: 'success' });
      trackMetric('proof.verification.count', 1, { proofType, status: 'success' });
    },
    failure: (proofType: string, error: string) => {
      trackMetric('proof.verification.count', 1, { proofType, status: 'failure', error });
    },
  },

  transaction: {
    start: () => startTimer('transaction.submit'),
    success: (txType: string, durationMs: number) => {
      trackTiming('transaction.submit', durationMs, { txType, status: 'success' });
      trackMetric('transaction.count', 1, { txType, status: 'success' });
    },
    failure: (txType: string, error: string) => {
      trackMetric('transaction.count', 1, { txType, status: 'failure', error });
    },
  },

  walletConnection: {
    connected: (walletName: string) => {
      trackMetric('wallet.connection', 1, { walletName, action: 'connect' });
    },
    disconnected: (walletName: string) => {
      trackMetric('wallet.connection', 1, { walletName, action: 'disconnect' });
    },
  },
};
