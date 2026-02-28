import { Controller, Get, UseGuards } from '@nestjs/common';
import { JwtAuthGuard } from '../auth/infrastructure/jwt-auth.guard';
import { OpenClawPresenceService } from './openclaw-presence.service';
import { execSync } from 'child_process';
import * as fs from 'fs';
import * as path from 'path';

export interface OpenClawAgent {
  id: string;          // openclaw agent id (main, finance, ...)
  name: string;        // from IDENTITY.md
  emoji: string;       // from IDENTITY.md
  role: string;        // from IDENTITY.md
  isDefault: boolean;  // true for main agent
  officeRole: 'DIRECTOR' | 'BACKEND' | 'FINANCIER' | 'FRONTEND' | 'DEVOPS' | 'ARCHITECT' | 'SECURITY' | 'ARCHIVIST' | 'SOLUTION_ARCHITECT' | 'SQL_ARCHITECT' | 'TECH_WRITER' | 'QA' | 'PRODUCT' | 'TECH_LEAD' | 'BA';
}

const ROLE_MAP: Record<string, OpenClawAgent['officeRole']> = {
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

function parseIdentity(workspace: string): { name: string; emoji: string; role: string } {
  const identityPath = path.join(workspace, 'IDENTITY.md');
  if (!fs.existsSync(identityPath)) {
    return { name: 'Unknown', emoji: '🤖', role: 'Agent' };
  }

  const content = fs.readFileSync(identityPath, 'utf-8');

  const nameMatch = content.match(/\*\*Name:\*\*\s*(.+)/);
  const emojiMatch = content.match(/\*\*Emoji:\*\*\s*(.+)/);
  const roleMatch = content.match(/\*\*Role:\*\*\s*(.+)/);
  const creatureMatch = content.match(/\*\*Creature:\*\*\s*(.+)/);

  return {
    name: nameMatch?.[1]?.trim() ?? 'Unknown',
    emoji: emojiMatch?.[1]?.trim() ?? '🤖',
    role: roleMatch?.[1]?.trim() ?? creatureMatch?.[1]?.trim() ?? 'Agent',
  };
}

function getOpenClawAgents(): OpenClawAgent[] {
  try {
    const output = execSync('openclaw agents list 2>/dev/null || openclaw agent list 2>/dev/null', {
      encoding: 'utf-8',
      timeout: 5000,
    });

    // Parse: "- agentId (name)" lines
    const agentLines = output.match(/^-\s+(\S+)\s+\(([^)]+)\)/gm) ?? [];
    const defaultMatch = output.match(/^-\s+(\S+)\s+\(default\)/m);
    const defaultId = defaultMatch?.[1] ?? 'main';

    const agents: OpenClawAgent[] = agentLines.map((line) => {
      const match = line.match(/^-\s+(\S+)/);
      const id = match?.[1] ?? 'unknown';

      // Find workspace path from output
      const workspaceMatch = output
        .split(/^-\s+/m)
        .find((block) => block.startsWith(id + ' ') || block.startsWith(id + '\n'));

      const wsLineMatch = output.match(new RegExp(`Workspace:\\s*(.+)`, 'g'));
      // Use standard path convention: ~/.openclaw/workspace[-agentId]
      const workspacePath = id === 'main'
        ? '/root/.openclaw/workspace'
        : `/root/.openclaw/workspace-${id}`;

      const identity = parseIdentity(workspacePath);

      return {
        id,
        name: identity.name,
        emoji: identity.emoji,
        role: identity.role,
        isDefault: id === defaultId,
        officeRole: ROLE_MAP[id] ?? 'FRONTEND',
      };
    });

    return agents.length > 0 ? agents : getFallback();
  } catch {
    return getFallback();
  }
}

function getFallback(): OpenClawAgent[] {
  // Direct filesystem scan as fallback
  const baseDir = '/root/.openclaw';
  const agents: OpenClawAgent[] = [];

  const workspaceDirs = fs.readdirSync(baseDir).filter((d) => d.startsWith('workspace'));

  for (const dir of workspaceDirs) {
    const id = dir === 'workspace' ? 'main' : dir.replace('workspace-', '');
    const workspacePath = path.join(baseDir, dir);
    const identity = parseIdentity(workspacePath);

    if (identity.name !== 'Unknown') {
      agents.push({
        id,
        name: identity.name,
        emoji: identity.emoji,
        role: identity.role,
        isDefault: id === 'main',
        officeRole: ROLE_MAP[id] ?? 'FRONTEND',
      });
    }
  }

  // Sort: main first
  return agents.sort((a, b) => (a.id === 'main' ? -1 : b.id === 'main' ? 1 : 0));
}

@Controller('openclaw-agents')
@UseGuards(JwtAuthGuard)
export class OpenClawController {
  constructor(private readonly presenceService: OpenClawPresenceService) {}

  @Get()
  getAgents(): OpenClawAgent[] {
    return getOpenClawAgents();
  }

  @Get('activity')
  getActivity() {
    return this.presenceService.getActivityStatuses();
  }
}
