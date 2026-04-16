import { HttpException, HttpStatus, Injectable } from '@nestjs/common';

/**
 * In-memory per-API-key sliding window (1 hour) for public API rate limits.
 * Resets the window after WINDOW_MS of inactivity from the first request in that window.
 */
@Injectable()
export class ApiKeyRateLimiterService {
  private readonly WINDOW_MS = 60 * 60 * 1000;
  private readonly buckets = new Map<string, { windowStart: number; count: number }>();

  /**
   * Throws 429 when the key has exceeded limitPerHour in the current window.
   * No-op when limitPerHour is missing or non-positive (treat as unlimited).
   */
  checkOrThrow(apiKeyId: string, limitPerHour: number | null | undefined): void {
    if (limitPerHour == null || limitPerHour <= 0) {
      return;
    }

    const now = Date.now();
    let bucket = this.buckets.get(apiKeyId);

    if (!bucket || now - bucket.windowStart >= this.WINDOW_MS) {
      bucket = { windowStart: now, count: 0 };
      this.buckets.set(apiKeyId, bucket);
    }

    if (bucket.count >= limitPerHour) {
      throw new HttpException(
        {
          code: 429,
          status: 'error',
          message: 'API key rate limit exceeded. Try again later.',
        },
        HttpStatus.TOO_MANY_REQUESTS,
      );
    }

    bucket.count += 1;
  }
}
