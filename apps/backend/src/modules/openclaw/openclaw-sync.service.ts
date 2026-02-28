import { Injectable, OnModuleInit, Logger } from '@nestjs/common';
import * as fs from 'fs';
import * as path from 'path';
import { PrismaService } from '../../common/prisma/prisma.service';

interface AgentSeed {
  openclawId: string;  // e.g. 'main', 'ddd'
  name: string;        // e.g. '🖤 Пятница'
  role: string;        // e.g. 'DIRECTOR'
  tenantId: string;
}

/**
 * Role map: openclaw agent id → office role.
 * Derived from ROLE_MAP in openclaw.controller.ts — keep in sync.
 */
const ROLE_MAP: Record<string, string> = {
  main:       'DIRECTOR',
  finance:    'FINANCIER',
  backend:    'BACKEND',
  devops:     'DEVOPS',
  frontend:   'FRONTEND',
  ddd:        'ARCHITECT',
  security:   'SECURITY',
  archivist:  'ARCHIVIST',
  solution:   'SOLUTION_ARCHITECT',
  sql:        'SQL_ARCHITECT',
  techwriter: 'TECH_WRITER',
  qa:         'QA',
  product:    'PRODUCT',
  techlead:   'TECH_LEAD',
  ba:         'BA',
};

const DEFAULT_TENANT_ID = 'tenant-smoke';
const OPENCLAW_BASE = '/root/.openclaw';

function parseIdentity(workspace: string): { name: string; emoji: string } | null {
  const identityPath = path.join(workspace, 'IDENTITY.md');
  if (!fs.existsSync(identityPath)) return null;

  const content = fs.readFileSync(identityPath, 'utf-8');

  const nameMatch = content.match(/\*\*Name:\*\*\s*(.+)/);
  const emojiMatch = content.match(/\*\*Emoji:\*\*\s*(.+)/);

  const name = nameMatch?.[1]?.trim();
  const emoji = emojiMatch?.[1]?.trim() ?? '🤖';

  if (!name) return null;
  return { name, emoji };
}

/**
 * OpenClawSyncService:
 * На старте приложения сканирует workspace-директории OpenClaw
 * и создаёт записи агентов в БД если они ещё не существуют.
 * Существующие агенты НЕ перезаписываются (upsert по name).
 */
@Injectable()
export class OpenClawSyncService implements OnModuleInit {
  private readonly logger = new Logger(OpenClawSyncService.name);

  constructor(private readonly prisma: PrismaService) {}

  async onModuleInit(): Promise<void> {
    await this.syncAgents();
  }

  async syncAgents(): Promise<void> {
    try {
      const seeds = this.discoverAgents();
      this.logger.log(`Discovered ${seeds.length} OpenClaw agents for sync`);

      for (const seed of seeds) {
        await this.upsertAgent(seed);
      }
    } catch (err) {
      this.logger.warn(`Agent sync failed: ${(err as Error).message}`);
    }
  }

  private discoverAgents(): AgentSeed[] {
    if (!fs.existsSync(OPENCLAW_BASE)) return [];

    const workspaceDirs = fs.readdirSync(OPENCLAW_BASE).filter((d) =>
      d.startsWith('workspace'),
    );

    const seeds: AgentSeed[] = [];

    for (const dir of workspaceDirs) {
      const agentId = dir === 'workspace' ? 'main' : dir.replace('workspace-', '');
      const role = ROLE_MAP[agentId];

      if (!role) {
        this.logger.debug(`No role mapping for agent '${agentId}', skipping`);
        continue;
      }

      const workspacePath = path.join(OPENCLAW_BASE, dir);
      const identity = parseIdentity(workspacePath);

      if (!identity) {
        this.logger.debug(`No IDENTITY.md for agent '${agentId}', skipping`);
        continue;
      }

      const displayName = `${identity.emoji} ${identity.name}`;

      seeds.push({
        openclawId: agentId,
        name: displayName,
        role,
        tenantId: DEFAULT_TENANT_ID,
      });
    }

    return seeds;
  }

  /**
   * Upsert agent by name — если агент уже в БД (в любом tenant), не трогаем его данные.
   * Если нет — создаём в DEFAULT_TENANT_ID.
   */
  private async upsertAgent(seed: AgentSeed): Promise<void> {
    // Search by name regardless of tenant (openclaw agents are unique by name)
    const existing = await this.prisma.agent.findFirst({
      where: { name: seed.name },
    });

    if (existing) {
      this.logger.debug(`Agent '${seed.name}' already exists (id: ${existing.id}, tenant: ${existing.tenantId}), skipping`);
      return;
    }

    const created = await this.prisma.agent.create({
      data: {
        tenantId: seed.tenantId,
        name: seed.name,
        role: seed.role,
        status: 'IDLE',
        version: 0,
      },
    });

    this.logger.log(`Created agent '${seed.name}' (${seed.role}) → id: ${created.id}`);
  }
}
