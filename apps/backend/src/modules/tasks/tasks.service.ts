import { Injectable, NotFoundException } from '@nestjs/common';
import { PrismaService } from '../../common/prisma/prisma.service';
import { TaskStatus } from '@prisma/client';
import * as fs from 'fs';
import * as path from 'path';
import * as os from 'os';
import * as readline from 'readline';

export interface ToolCall {
  name: string;
  input: Record<string, unknown>;
  output: string;
}

export interface SessionMessage {
  role: 'user' | 'assistant';
  content: string;
  timestamp?: string;
  hasToolCalls: boolean;
  toolCalls?: ToolCall[];
}

export interface CreateTaskDto {
  title: string;
  description?: string;
  agentId?: string;
  agentName?: string;
  sessionKey?: string;
  status?: TaskStatus;
}

export interface UpdateTaskDto {
  status?: TaskStatus;
  result?: string;
  sessionKey?: string;
  agentName?: string;
  title?: string;
  description?: string;
}

export interface ListTasksOptions {
  page: number;
  limit: number;
}

@Injectable()
export class TasksService {
  constructor(private readonly prisma: PrismaService) {}

  async findAll(tenantId: string, opts: ListTasksOptions) {
    const { page, limit } = opts;
    const skip = (page - 1) * limit;

    const [items, total] = await Promise.all([
      this.prisma.task.findMany({
        where: { tenantId },
        select: {
          id: true,
          title: true,
          status: true,
          agentName: true,
          createdAt: true,
          updatedAt: true,
        },
        orderBy: { createdAt: 'desc' },
        skip,
        take: limit,
      }),
      this.prisma.task.count({ where: { tenantId } }),
    ]);

    return {
      data: items,
      meta: {
        total,
        page,
        limit,
        pages: Math.ceil(total / limit),
      },
    };
  }

  async findOne(tenantId: string, id: string) {
    const task = await this.prisma.task.findFirst({
      where: { id, tenantId },
    });

    if (!task) {
      throw new NotFoundException(`Task ${id} not found`);
    }

    return task;
  }

  async create(tenantId: string, dto: CreateTaskDto) {
    return this.prisma.task.create({
      data: {
        tenantId,
        title: dto.title,
        description: dto.description,
        agentId: dto.agentId,
        agentName: dto.agentName,
        sessionKey: dto.sessionKey,
        status: dto.status ?? TaskStatus.PENDING,
      },
    });
  }

  async update(tenantId: string, id: string, dto: UpdateTaskDto) {
    // Verify task exists and belongs to tenant
    await this.findOne(tenantId, id);

    return this.prisma.task.update({
      where: { id },
      data: {
        ...(dto.status !== undefined && { status: dto.status }),
        ...(dto.result !== undefined && { result: dto.result }),
        ...(dto.sessionKey !== undefined && { sessionKey: dto.sessionKey }),
        ...(dto.agentName !== undefined && { agentName: dto.agentName }),
        ...(dto.title !== undefined && { title: dto.title }),
        ...(dto.description !== undefined && { description: dto.description }),
      },
    });
  }

  async remove(id: string, tenantId: string) {
    return this.prisma.task.delete({ where: { id, tenantId } });
  }

  async getHistory(tenantId: string, taskId: string): Promise<SessionMessage[]> {
    const task = await this.findOne(tenantId, taskId);

    // Возвращаем кеш если есть (защита от cleanup JSONL файлов OpenClaw)
    if (
      task.historySnapshot &&
      Array.isArray(task.historySnapshot) &&
      (task.historySnapshot as unknown[]).length > 0
    ) {
      return task.historySnapshot as unknown as SessionMessage[];
    }

    if (!task.sessionKey) {
      return [];
    }

    try {
      const messages = await this.readHistoryFromSessionStore(task.sessionKey);

      // Кешируем если нашли данные — защита от будущего cleanup
      if (messages.length > 0) {
        await this.prisma.task.update({
          where: { id: taskId },
          data: { historySnapshot: messages as unknown as object[] },
        });
      }

      return messages;
    } catch (err: unknown) {
      const message = err instanceof Error ? err.message : String(err);
      if (process.env.NODE_ENV !== 'production') {
        console.warn(`[TasksService] getHistory failed for sessionKey=${task.sessionKey}: ${message}`);
      }
      return [];
    }
  }

  /**
   * Reads conversation history directly from OpenClaw session store files.
   *
   * OpenClaw stores sessions as JSONL files at:
   *   ~/.openclaw/agents/<agentId>/sessions/<sessionId>.jsonl
   *
   * The sessions.json index maps sessionKey -> { sessionId, sessionFile, ... }.
   *
   * The CLI command `openclaw sessions history <key> --format json` does NOT exist
   * (openclaw sessions has no `history` subcommand as of 2026.2.x).
   */
  private async readHistoryFromSessionStore(sessionKey: string): Promise<SessionMessage[]> {
    const stateDir = process.env.OPENCLAW_STATE_DIR ?? path.join(os.homedir(), '.openclaw');

    // Extract agentId from sessionKey: "agent:<agentId>:..." -> agentId
    const keyParts = sessionKey.split(':');
    const agentId = keyParts.length >= 2 && keyParts[0] === 'agent' ? keyParts[1] : 'main';

    const sessionsJsonPath = path.join(stateDir, 'agents', agentId, 'sessions', 'sessions.json');

    if (!fs.existsSync(sessionsJsonPath)) {
      console.warn(`[TasksService] sessions.json not found: ${sessionsJsonPath}`);
      return [];
    }

    const sessionsIndex: Record<string, { sessionId?: string; sessionFile?: string }> = JSON.parse(
      fs.readFileSync(sessionsJsonPath, 'utf-8'),
    );

    const sessionEntry = sessionsIndex[sessionKey];
    if (!sessionEntry) {
      console.warn(`[TasksService] sessionKey not found in index: ${sessionKey}`);
      return [];
    }

    // Prefer explicit sessionFile path, fallback to constructed path
    const jsonlPath =
      sessionEntry.sessionFile ??
      (sessionEntry.sessionId
        ? path.join(stateDir, 'agents', agentId, 'sessions', `${sessionEntry.sessionId}.jsonl`)
        : null);

    if (!jsonlPath || !fs.existsSync(jsonlPath)) {
      console.warn(`[TasksService] JSONL file not found for sessionKey=${sessionKey}`);
      return [];
    }

    // Two-pass approach:
    // Pass 1: read all JSONL lines into memory, build toolOutputMap (toolCallId -> output)
    // Pass 2: build SessionMessage[] for user/assistant entries, enriching toolCalls with outputs

    // Map toolCallId -> output text (from toolResult messages)
    const toolOutputMap = new Map<string, string>();
    // Raw parsed lines (only message entries)
    const rawLines: Array<{ role: string; msg: Record<string, unknown>; ts?: string }> = [];

    await new Promise<void>((resolve, reject) => {
      const rl = readline.createInterface({
        input: fs.createReadStream(jsonlPath, { encoding: 'utf-8' }),
        crlfDelay: Infinity,
      });

      rl.on('line', (line) => {
        if (!line.trim()) return;
        try {
          const entry: Record<string, unknown> = JSON.parse(line);
          if (entry['type'] !== 'message' || !entry['message']) return;

          const msg = entry['message'] as Record<string, unknown>;
          const role = msg['role'] as string;
          const ts = (entry['timestamp'] as string | undefined) ?? undefined;

          if (role === 'toolResult') {
            // Collect tool outputs for enriching assistant toolCalls
            const toolCallId = msg['toolCallId'] as string | undefined;
            if (toolCallId) {
              toolOutputMap.set(toolCallId, this.extractContent(msg));
            }
            return;
          }

          if (role === 'user' || role === 'assistant') {
            rawLines.push({ role, msg, ts });
          }
        } catch {
          // Skip malformed lines
        }
      });

      rl.on('close', resolve);
      rl.on('error', reject);
    });

    // Pass 2: build final SessionMessage[] with enriched tool outputs
    const messages: SessionMessage[] = rawLines.map(({ role, msg, ts }) => {
      const toolCalls = this.extractToolCalls(msg, toolOutputMap);
      return {
        role: role as 'user' | 'assistant',
        content: this.extractContent(msg),
        timestamp: ts,
        hasToolCalls: toolCalls.length > 0,
        toolCalls: toolCalls.length > 0 ? toolCalls : undefined,
      };
    });

    const limit = 100;
    // Return last N messages (most recent history)
    return messages.slice(-limit);
  }

  private extractContent(entry: Record<string, unknown>): string {
    const content = entry['content'];
    if (typeof content === 'string') return content;
    if (Array.isArray(content)) {
      // OpenClaw JSONL content blocks: { type: 'text', text: '...' }
      return (content as Record<string, unknown>[])
        .filter((b) => b['type'] === 'text')
        .map((b) => b['text'] as string)
        .join('\n');
    }
    return '';
  }

  /**
   * Extracts tool calls from an OpenClaw JSONL message content array.
   * Returns ToolCall[] with an extra internal _id field for toolOutputMap lookup.
   */
  private extractToolCalls(
    entry: Record<string, unknown>,
    toolOutputMap?: Map<string, string>,
  ): ToolCall[] {
    const content = entry['content'];
    if (!Array.isArray(content)) return [];

    const calls: ToolCall[] = [];
    for (const block of content as Record<string, unknown>[]) {
      // OpenClaw JSONL uses { type: 'toolCall', id, name, arguments }
      // (not Anthropic SDK's tool_use / input)
      if (block['type'] === 'toolCall') {
        const id = block['id'] as string | undefined;
        const output = (id && toolOutputMap?.get(id)) || '';
        calls.push({
          name: block['name'] as string,
          input: (block['arguments'] ?? block['input'] ?? {}) as Record<string, unknown>,
          output,
        });
      }
    }
    return calls;
  }

  // Auto-cleanup stale RUNNING tasks (no sessionKey or older than 2h)
  async cleanupStaleTasks(): Promise<number> {
    const twoHoursAgo = new Date(Date.now() - 2 * 60 * 60 * 1000);
    const result = await this.prisma.task.updateMany({
      where: {
        status: 'RUNNING',
        OR: [
          { sessionKey: null },
          { updatedAt: { lt: twoHoursAgo } },
        ],
      },
      data: { status: 'DONE' },
    });
    return result.count;
  }
}
