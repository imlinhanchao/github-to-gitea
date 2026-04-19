import { Injectable, OnModuleInit } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository } from 'typeorm';
import { SyncTaskEntity } from '../../entities/sync-task.entity';

interface QueueItem {
  taskId: number;
  fn: () => Promise<unknown>;
}

@Injectable()
export class SyncQueueService implements OnModuleInit {
  private readonly queue: QueueItem[] = [];
  private running = false;

  constructor(
    @InjectRepository(SyncTaskEntity)
    private readonly taskRepo: Repository<SyncTaskEntity>,
  ) {}

  async onModuleInit(): Promise<void> {
    // Reset any tasks that were interrupted mid-run back to pending
    await this.taskRepo.update({ status: 'running' }, { status: 'pending', startedAt: null });
  }

  async enqueue(repoFullName: string, fn: () => Promise<unknown>): Promise<SyncTaskEntity> {
    const task = await this.taskRepo.save(
      this.taskRepo.create({
        repoFullName,
        status: 'pending',
        error: null,
        createdAt: new Date().toISOString(),
        startedAt: null,
        finishedAt: null,
      }),
    );
    this.queue.push({ taskId: task.id, fn });
    void this.processNext();
    return task;
  }

  async listTasks(limit = 50): Promise<SyncTaskEntity[]> {
    return this.taskRepo.find({ order: { createdAt: 'DESC' }, take: limit });
  }

  async getTask(id: number): Promise<SyncTaskEntity> {
    return this.taskRepo.findOneByOrFail({ id });
  }

  private async processNext(): Promise<void> {
    if (this.running || this.queue.length === 0) {
      return;
    }
    this.running = true;
    const item = this.queue.shift()!;
    const now = new Date().toISOString();
    await this.taskRepo.update(item.taskId, { status: 'running', startedAt: now });
    try {
      await item.fn();
      await this.taskRepo.update(item.taskId, { status: 'done', finishedAt: new Date().toISOString() });
    } catch (err: unknown) {
      const message = err instanceof Error ? err.message : String(err);
      await this.taskRepo.update(item.taskId, {
        status: 'failed',
        error: message,
        finishedAt: new Date().toISOString(),
      });
    } finally {
      this.running = false;
      void this.processNext();
    }
  }
}
