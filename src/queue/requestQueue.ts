import { logger } from "../utils/logger.js";

type Task<T> = () => Promise<T>;

export class RequestQueue {
  private queue: Array<{
    task: Task<unknown>;
    resolve: (value: unknown) => void;
    reject: (error: unknown) => void;
  }> = [];
  private running = false;

  async enqueue<T>(task: Task<T>): Promise<T> {
    return new Promise<T>((resolve, reject) => {
      this.queue.push({
        task: task as Task<unknown>,
        resolve: resolve as (value: unknown) => void,
        reject,
      });
      this.process();
    });
  }

  private async process(): Promise<void> {
    if (this.running) return;
    this.running = true;

    while (this.queue.length > 0) {
      const item = this.queue.shift()!;
      try {
        logger.debug(`Processing queued request (${this.queue.length} remaining)`);
        const result = await item.task();
        item.resolve(result);
      } catch (err) {
        item.reject(err);
      }
    }

    this.running = false;
  }

  get size(): number {
    return this.queue.length;
  }
}

export const globalQueue = new RequestQueue();
