import {
  Injectable,
  NestInterceptor,
  ExecutionContext,
  CallHandler,
  StreamableFile,
} from '@nestjs/common';
import { Observable } from 'rxjs';
import { map } from 'rxjs/operators';
/**
 * Recursively convert Prisma Decimal and BigInt to JSON-serializable values.
 * Without this, JSON.stringify() throws when responses contain Decimal/BigInt (e.g. animals list),
 * causing 502 from the server.
 */
function toSerializable(value: unknown): unknown {
  try {
    if (value === null || value === undefined) {
      return value;
    }
    if (typeof value === 'bigint') {
      return value.toString();
    }
    // Prisma Decimal (decimal.js): not JSON-serializable. Detect without relying only on
    // constructor.name (it can be minified to 'i' in production and break detection).
    if (
      typeof value === 'object' &&
      value !== null &&
      !Array.isArray(value) &&
      !(value instanceof Date)
    ) {
      const obj = value as Record<string, unknown>;
      const tag = Object.prototype.toString.call(value);
      const isDecimal =
        tag === '[object Decimal]' ||
        obj.constructor?.name === 'Decimal' ||
        (typeof obj.toString === 'function' && typeof obj.toFixed === 'function');
      if (isDecimal) {
        return (value as { toString: () => string }).toString();
      }
    }
    if (value instanceof Date) {
      return value.toISOString();
    }
    if (Array.isArray(value)) {
      return value.map(toSerializable);
    }
    if (typeof value === 'object' && value !== null) {
      const out: Record<string, unknown> = {};
      for (const [k, v] of Object.entries(value)) {
        out[k] = toSerializable(v);
      }
      return out;
    }
    return value;
  } catch {
    // Never throw: avoid 502 from serialization; fallback to string
    if (value !== null && typeof value === 'object' && typeof (value as { toString?: () => string }).toString === 'function') {
      return (value as { toString: () => string }).toString();
    }
    return String(value);
  }
}

@Injectable()
export class SerializePrismaInterceptor implements NestInterceptor {
  intercept(context: ExecutionContext, next: CallHandler): Observable<unknown> {
    return next.handle().pipe(
      map((data: unknown) => (data instanceof StreamableFile ? data : toSerializable(data))),
    );
  }
}
