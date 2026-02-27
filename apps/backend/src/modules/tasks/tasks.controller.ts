import {
  Controller,
  Get,
  Post,
  Patch,
  Delete,
  Body,
  Param,
  Query,
  HttpCode,
  HttpStatus,
  UseGuards,
  ParseIntPipe,
  DefaultValuePipe,
} from '@nestjs/common';
import { JwtAuthGuard } from '../auth/infrastructure/jwt-auth.guard';
import { TenantId } from '../auth/decorators/tenant.decorator';
import { TasksService } from './tasks.service';
import { CreateTaskDto } from './dto/create-task.dto';
import { UpdateTaskDto } from './dto/update-task.dto';

@Controller('tasks')
@UseGuards(JwtAuthGuard)
export class TasksController {
  constructor(private readonly tasksService: TasksService) {}

  /**
   * GET /tasks?page=1&limit=20
   * Список задач тенанта с пагинацией
   */
  @Get()
  async findAll(
    @TenantId() tenantId: string,
    @Query('page', new DefaultValuePipe(1), ParseIntPipe) page: number,
    @Query('limit', new DefaultValuePipe(20), ParseIntPipe) limit: number,
  ) {
    const safeLimit = Math.min(limit, 100);
    return this.tasksService.findAll(tenantId, { page, limit: safeLimit });
  }

  /**
   * GET /tasks/:id
   * Детали задачи (все поля)
   */
  @Get(':id')
  async findOne(
    @TenantId() tenantId: string,
    @Param('id') id: string,
  ) {
    return this.tasksService.findOne(tenantId, id);
  }

  /**
   * GET /tasks/:id/history
   * История сессии OpenClaw для задачи
   */
  @Get(':id/history')
  async getHistory(
    @TenantId() tenantId: string,
    @Param('id') id: string,
  ) {
    return this.tasksService.getHistory(tenantId, id);
  }

  /**
   * POST /tasks
   * Создать задачу
   */
  @Post()
  @HttpCode(HttpStatus.CREATED)
  async create(
    @TenantId() tenantId: string,
    @Body() dto: CreateTaskDto,
  ) {
    return this.tasksService.create(tenantId, dto);
  }

  /**
   * PATCH /tasks/:id
   * Обновить статус/результат задачи
   */
  @Patch(':id')
  async update(
    @TenantId() tenantId: string,
    @Param('id') id: string,
    @Body() dto: UpdateTaskDto,
  ) {
    return this.tasksService.update(tenantId, id, dto);
  }

  /**
   * DELETE /tasks/:id
   * Удалить задачу
   */
  @Delete(':id')
  remove(@Param('id') id: string, @TenantId() tenantId: string) {
    return this.tasksService.remove(id, tenantId);
  }
}
