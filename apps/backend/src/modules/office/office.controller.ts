import {
  Controller,
  Post,
  Get,
  Body,
  Param,
  HttpCode,
  HttpStatus,
  UseGuards,
} from '@nestjs/common';
import { JwtAuthGuard } from '../auth/infrastructure/jwt-auth.guard';
import { TenantId } from '../auth/decorators/tenant.decorator';
import { CreateFloorUseCase } from './application/use-cases/create-floor.use-case';
import { CreateDepartmentUseCase } from './application/use-cases/create-department.use-case';
import { CreateFloorDto } from './application/dto/create-floor.dto';
import { CreateDepartmentDto } from './application/dto/create-department.dto';
import { PrismaService } from '../../common/prisma/prisma.service';

@Controller('floors')
@UseGuards(JwtAuthGuard)
export class OfficeController {
  constructor(
    private readonly createFloorUseCase: CreateFloorUseCase,
    private readonly createDepartmentUseCase: CreateDepartmentUseCase,
    private readonly prisma: PrismaService,
  ) {}

  @Post()
  @HttpCode(HttpStatus.CREATED)
  async createFloor(@Body() dto: CreateFloorDto, @TenantId() tenantId: string) {
    return this.createFloorUseCase.execute(dto, tenantId);
  }

  @Get()
  async listFloors(@TenantId() tenantId: string) {
    return this.prisma.floor.findMany({
      where: { tenantId },
      include: { zones: true },
      orderBy: { createdAt: 'asc' },
    });
  }

  @Post(':id/departments')
  @HttpCode(HttpStatus.CREATED)
  async createDepartment(
    @Param('id') floorId: string,
    @Body() dto: CreateDepartmentDto,
    @TenantId() tenantId: string,
  ) {
    return this.createDepartmentUseCase.execute(floorId, dto, tenantId);
  }
}
