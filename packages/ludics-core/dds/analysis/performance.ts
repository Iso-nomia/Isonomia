/**
 * DDS Phase 5 - Part 3: Performance Tracking
 * 
 * Tracks performance metrics for ludics operations to identify
 * bottlenecks and optimize critical paths.
 */

import type {
  PerformanceMetric,
  PerformanceStats,
  BottleneckAnalysis,
} from "./types";
import { createPerformanceMetric, computePerformanceStats } from "./types";

// In-memory metrics store (production would use database)
const metricsStore: PerformanceMetric[] = [];

/**
 * Track performance of an operation
 * 
 * Wraps a function and records its execution time and success status.
 */
export async function trackPerformance<T>(
  operation: string,
  inputSize: number,
  fn: () => Promise<T>
): Promise<{ result: T; metric: PerformanceMetric }> {
  const startTime = performance.now();
  const startMemory = getMemoryUsage();

  let successful = true;
  let result: T;
  let error: Error | undefined;

  try {
    result = await fn();
  } catch (e) {
    successful = false;
    error = e instanceof Error ? e : new Error(String(e));
    throw error;
  } finally {
    const endTime = performance.now();
    const endMemory = getMemoryUsage();

    const duration = (endTime - startTime) / 1000; // Convert to seconds
    const memoryUsed = endMemory - startMemory;

    const metric = createPerformanceMetric(operation, inputSize, duration, successful, {
      memoryUsed: memoryUsed > 0 ? memoryUsed : undefined,
      metadata: error ? { error: error.message } : undefined,
    });

    // Store metric
    metricsStore.push(metric);

    // Log if slow
    if (duration > 5) {
      console.warn(
        `Slow operation: ${operation} took ${duration.toFixed(2)}s`
      );
    }
  }

  return {
    result: result!,
    metric: metricsStore[metricsStore.length - 1],
  };
}

/**
 * Track synchronous operation performance
 */
export function trackPerformanceSync<T>(
  operation: string,
  inputSize: number,
  fn: () => T
): { result: T; metric: PerformanceMetric } {
  const startTime = performance.now();
  const startMemory = getMemoryUsage();

  let successful = true;
  let result: T;
  let error: Error | undefined;

  try {
    result = fn();
  } catch (e) {
    successful = false;
    error = e instanceof Error ? e : new Error(String(e));
    throw error;
  } finally {
    const endTime = performance.now();
    const endMemory = getMemoryUsage();

    const duration = (endTime - startTime) / 1000;
    const memoryUsed = endMemory - startMemory;

    const metric = createPerformanceMetric(operation, inputSize, duration, successful, {
      memoryUsed: memoryUsed > 0 ? memoryUsed : undefined,
      metadata: error ? { error: error.message } : undefined,
    });

    metricsStore.push(metric);
  }

  return {
    result: result!,
    metric: metricsStore[metricsStore.length - 1],
  };
}

/**
 * Get memory usage in MB (if available)
 */
function getMemoryUsage(): number {
  if (typeof process !== "undefined" && process.memoryUsage) {
    return process.memoryUsage().heapUsed / (1024 * 1024);
  }
  return 0;
}

/**
 * Get all stored metrics
 */
export function getAllMetrics(): PerformanceMetric[] {
  return [...metricsStore];
}

/**
 * Get metrics for a specific operation
 */
export function getMetricsForOperation(operation: string): PerformanceMetric[] {
  return metricsStore.filter((m) => m.operation === operation);
}

/**
 * Get performance statistics for an operation
 */
export function getPerformanceStats(operation: string): PerformanceStats {
  const metrics = getMetricsForOperation(operation);
  return computePerformanceStats(operation, metrics);
}

/**
 * Get statistics for all operations
 */
export function getAllPerformanceStats(): Map<string, PerformanceStats> {
  const operations = new Set(metricsStore.map((m) => m.operation));
  const stats = new Map<string, PerformanceStats>();

  for (const op of operations) {
    stats.set(op, getPerformanceStats(op));
  }

  return stats;
}

/**
 * Analyze performance bottlenecks
 */
export function analyzeBottlenecks(
  thresholds?: {
    slowDurationSeconds?: number;
    memoryMB?: number;
    failureRateThreshold?: number;
  }
): BottleneckAnalysis {
  const opts = {
    slowDurationSeconds: thresholds?.slowDurationSeconds ?? 5,
    memoryMB: thresholds?.memoryMB ?? 100,
    failureRateThreshold: thresholds?.failureRateThreshold ?? 0.1,
  };

  const slowOperations: string[] = [];
  const memoryIntensive: string[] = [];
  const failureProneOperations: string[] = [];
  const recommendations: string[] = [];

  const allStats = getAllPerformanceStats();

  for (const [operation, stats] of allStats) {
    // Check for slow operations
    if (stats.avgDuration > opts.slowDurationSeconds) {
      slowOperations.push(operation);
      recommendations.push(
        `Consider optimizing '${operation}' (avg: ${stats.avgDuration.toFixed(2)}s)`
      );
    }

    // Check for high failure rate
    if (stats.successRate < 1 - opts.failureRateThreshold) {
      failureProneOperations.push(operation);
      recommendations.push(
        `Investigate failures in '${operation}' (success rate: ${(stats.successRate * 100).toFixed(1)}%)`
      );
    }
  }

  // Check for memory-intensive operations
  const memoryMetrics = metricsStore.filter(
    (m) => m.memoryUsed && m.memoryUsed > opts.memoryMB
  );
  const memoryOps = new Set(memoryMetrics.map((m) => m.operation));
  memoryIntensive.push(...memoryOps);

  for (const op of memoryOps) {
    const maxMemory = Math.max(
      ...memoryMetrics
        .filter((m) => m.operation === op)
        .map((m) => m.memoryUsed || 0)
    );
    recommendations.push(
      `Consider memory optimization for '${op}' (peak: ${maxMemory.toFixed(1)}MB)`
    );
  }

  return {
    slowOperations,
    memoryIntensive,
    failureProneOperations,
    recommendations,
  };
}

/**
 * Clear all stored metrics
 */
export function clearMetrics(): void {
  metricsStore.length = 0;
}

/**
 * Get recent metrics (last N)
 */
export function getRecentMetrics(count: number = 100): PerformanceMetric[] {
  return metricsStore.slice(-count);
}

/**
 * Get metrics within a time window
 */
export function getMetricsInWindow(
  startTime: Date,
  endTime: Date
): PerformanceMetric[] {
  return metricsStore.filter((m) => {
    const recordedAt = m.recordedAt.getTime();
    return recordedAt >= startTime.getTime() && recordedAt <= endTime.getTime();
  });
}

/**
 * Performance decorator for class methods
 */
export function tracked(operationName?: string) {
  return function (
    target: any,
    propertyKey: string,
    descriptor: PropertyDescriptor
  ) {
    const originalMethod = descriptor.value;
    const operation = operationName || `${target.constructor.name}.${propertyKey}`;

    descriptor.value = async function (...args: any[]) {
      const inputSize = args.length > 0 ? JSON.stringify(args).length : 0;

      const { result } = await trackPerformance(operation, inputSize, () =>
        originalMethod.apply(this, args)
      );

      return result;
    };

    return descriptor;
  };
}

/**
 * Create a performance report
 */
export function generatePerformanceReport(): {
  summary: {
    totalOperations: number;
    totalDuration: number;
    avgDuration: number;
    successRate: number;
  };
  byOperation: Record<string, PerformanceStats>;
  bottlenecks: BottleneckAnalysis;
  recentSlowOperations: PerformanceMetric[];
} {
  const metrics = getAllMetrics();
  const allStats = getAllPerformanceStats();

  const totalDuration = metrics.reduce((sum, m) => sum + m.duration, 0);
  const successCount = metrics.filter((m) => m.successful).length;

  const summary = {
    totalOperations: metrics.length,
    totalDuration,
    avgDuration: metrics.length > 0 ? totalDuration / metrics.length : 0,
    successRate: metrics.length > 0 ? successCount / metrics.length : 1,
  };

  const byOperation: Record<string, PerformanceStats> = {};
  for (const [op, stats] of allStats) {
    byOperation[op] = stats;
  }

  const bottlenecks = analyzeBottlenecks();

  const recentSlowOperations = getRecentMetrics(20).filter(
    (m) => m.duration > 2
  );

  return {
    summary,
    byOperation,
    bottlenecks,
    recentSlowOperations,
  };
}

/**
 * Export metrics to JSON
 */
export function exportMetricsToJSON(): string {
  return JSON.stringify(
    {
      exportedAt: new Date().toISOString(),
      metrics: metricsStore,
    },
    null,
    2
  );
}

/**
 * Import metrics from JSON
 */
export function importMetricsFromJSON(json: string): void {
  const data = JSON.parse(json);
  if (Array.isArray(data.metrics)) {
    for (const m of data.metrics) {
      metricsStore.push({
        ...m,
        recordedAt: new Date(m.recordedAt),
      });
    }
  }
}
