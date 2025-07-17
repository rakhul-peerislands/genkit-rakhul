/**
 * Copyright 2024 Google LLC
 *
 * Licensed under the Apache License, Version 2.0 (the "License");
 * you may not use this file except in compliance with the License.
 * You may obtain a copy of the License at
 *
 *     http://www.apache.org/licenses/LICENSE-2.0
 *
 * Unless required by applicable law or agreed to in writing, software
 * distributed under the License is distributed on an "AS IS" BASIS,
 * WITHOUT WARRANTIES OR CONDITIONS OF ANY KIND, either express or implied.
 * See the License for the specific language governing permissions and
 * limitations under the License.
 */

import {
  BASE_RETRY_DELAY_MS,
  JITTER_FACTOR,
  RETRY_ATTEMPTS,
} from '../common/constants';
import { RetryOptions } from './types';

function calculateDelay(
  attempt: number,
  baseDelay: number,
  jitterFactor: number
): number {
  const exponentialDelay = baseDelay * Math.pow(2, attempt - 1);
  const jitterRange = exponentialDelay * jitterFactor;
  const jitter = (Math.random() - 0.5) * 2 * jitterRange;

  return Math.max(0, exponentialDelay + jitter);
}

export async function retryWithDelay<T>(
  operation: () => Promise<T>,
  retryOptions?: RetryOptions
): Promise<T> {
  const retryAttempts = retryOptions?.retryAttempts ?? RETRY_ATTEMPTS;
  const baseDelay = retryOptions?.baseDelay ?? BASE_RETRY_DELAY_MS;
  const jitterFactor = retryOptions?.jitterFactor ?? JITTER_FACTOR;

  let lastError: Error = new Error('Unknown error');

  for (let attempt = 1; attempt <= retryAttempts + 1; attempt++) {
    try {
      return await operation();
    } catch (error) {
      lastError = error instanceof Error ? error : new Error(String(error));
      if (attempt === retryAttempts + 1) {
        throw lastError;
      }
      const delay = calculateDelay(attempt, baseDelay, jitterFactor);
      console.warn(
        `Attempt ${attempt} failed: ${lastError.message}. Retrying in ${delay}ms`
      );
      await new Promise((resolve) => setTimeout(resolve, delay));
    }
  }
  throw lastError!;
}
