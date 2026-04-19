import { Body, Controller, Get, Param, ParseIntPipe, Patch, Post, Query } from '@nestjs/common';
import { AddAccountDto } from '../../dto/add-account.dto';
import { AddRepoDto } from '../../dto/add-repo.dto';
import { UpdateBranchesDto } from '../../dto/update-branches.dto';
import { SyncService } from './sync.service';

@Controller('sync')
export class SyncController {
  constructor(private readonly syncService: SyncService) {}

  @Post('account')
  addAccount(@Body() dto: AddAccountDto) {
    return this.syncService.addAccount(dto.account);
  }

  @Post('repository')
  addRepository(@Body() dto: AddRepoDto) {
    return this.syncService.addRepository(dto.fullName);
  }

  @Get('repositories')
  list() {
    return this.syncService.list();
  }

  @Patch('repositories/:id/branches')
  updateBranches(@Param('id', ParseIntPipe) id: number, @Body() dto: UpdateBranchesDto) {
    return this.syncService.updateBranches(id, dto.branches);
  }

  @Post('repositories/:id/run')
  runOne(@Param('id', ParseIntPipe) id: number) {
    return this.syncService.syncOne(id);
  }

  @Get('tasks')
  listTasks(@Query('limit') limit?: string) {
    const parsed = limit ? parseInt(limit, 10) : undefined;
    return this.syncService.listTasks(Number.isFinite(parsed) ? parsed : undefined);
  }

  @Post('tasks/:id/retry')
  retryTask(@Param('id', ParseIntPipe) id: number) {
    return this.syncService.retryTask(id);
  }
}
