import { Body, Controller, Delete, Get, HttpCode, Param, ParseIntPipe, Patch, Post, Query } from '@nestjs/common';
import { AddAccountDto } from '../../dto/add-account.dto';
import { AddRepoDto } from '../../dto/add-repo.dto';
import { AddStarredAccountDto } from '../../dto/add-starred-account.dto';
import { SetEnabledDto } from '../../dto/set-enabled.dto';
import { SetupWebhookDto } from '../../dto/setup-webhook.dto';
import { UpdateBranchesDto } from '../../dto/update-branches.dto';
import { UpdateIgnoredReposDto } from '../../dto/update-ignored-repos.dto';
import { SyncService } from './sync.service';

@Controller('sync')
export class SyncController {
  private static readonly DEFAULT_PAGE = 1;
  private static readonly DEFAULT_PAGE_SIZE = 50;

  constructor(private readonly syncService: SyncService) {}

  @Post('account')
  addAccount(@Body() dto: AddAccountDto) {
    return this.syncService.addAccount(dto.account, dto.webhookUrl);
  }

  @Get('account/starred/preview')
  previewStarredRepos(@Query('account') account: string) {
    return this.syncService.previewStarredRepos(account);
  }

  @Post('account/starred')
  addStarredAccount(@Body() dto: AddStarredAccountDto) {
    return this.syncService.addStarredAccount(dto.account, dto.ignoredRepos ?? [], dto.webhookUrl);
  }

  @Get('starred-accounts')
  listStarredAccounts() {
    return this.syncService.listStarredAccounts();
  }

  @Patch('starred-accounts/:account/ignored')
  updateIgnoredRepos(@Param('account') account: string, @Body() dto: UpdateIgnoredReposDto) {
    return this.syncService.updateIgnoredRepos(account, dto.ignoredRepos);
  }

  @Post('repository')
  addRepository(@Body() dto: AddRepoDto) {
    return this.syncService.addRepository(dto.fullName, dto.webhookUrl);
  }

  @Get('repositories')
  list() {
    return this.syncService.list();
  }

  @Patch('repositories/:id/branches')
  updateBranches(@Param('id', ParseIntPipe) id: number, @Body() dto: UpdateBranchesDto) {
    return this.syncService.updateBranches(id, dto.branches);
  }

  @Patch('repositories/:id/enabled')
  setEnabled(@Param('id', ParseIntPipe) id: number, @Body() dto: SetEnabledDto) {
    return this.syncService.setEnabled(id, dto.enabled);
  }

  @Post('repositories/:id/run')
  runOne(@Param('id', ParseIntPipe) id: number) {
    return this.syncService.syncOne(id);
  }

  @Post('repositories/run-all')
  runAll() {
    return this.syncService.syncAll();
  }

  @Post('repositories/:id/webhook')
  @HttpCode(204)
  setupWebhook(@Param('id', ParseIntPipe) id: number, @Body() dto: SetupWebhookDto) {
    return this.syncService.setupWebhook(id, dto.webhookUrl);
  }

  @Get('tasks')
  listTasks(@Query('page') page?: string, @Query('pageSize') pageSize?: string) {
    return this.syncService.listTasks(
      this.parsePositiveInt(page, SyncController.DEFAULT_PAGE),
      this.parsePositiveInt(pageSize, SyncController.DEFAULT_PAGE_SIZE),
    );
  }

  @Post('tasks/:id/retry')
  retryTask(@Param('id', ParseIntPipe) id: number) {
    return this.syncService.retryTask(id);
  }

  @Delete('tasks/:id')
  @HttpCode(204)
  cancelTask(@Param('id', ParseIntPipe) id: number) {
    return this.syncService.cancelTask(id);
  }

  @Delete('tasks')
  clearTasks() {
    return this.syncService.clearTasks();
  }

  @Post('tasks/retry-failed')
  retryAllFailed() {
    return this.syncService.retryAllFailed();
  }

  private parsePositiveInt(value: string | undefined, fallback: number): number {
    const parsed = value ? parseInt(value, 10) : NaN;
    if (!Number.isFinite(parsed) || parsed < 1) {
      return fallback;
    }
    return parsed;
  }
}
