import { Controller, Get } from '@nestjs/common';
import * as fs from 'fs';
import * as path from 'path';
import * as readline from 'readline';
import * as os from 'os';
import { Public } from '../auth/decorators/public.decorator';

interface SessionStatus {
  tokensUsed: number;
  tokensTotal: number;
  tokensPercent: number;
  model: string;
  cacheHitRate: number;
}

interface UsageData {
  input?: number;
  output?: number;
  cacheRead?: number;
  cacheWrite?: number;
}

@Controller('session-status')
export class SessionStatusController {

  @Public()
  @Get()
  async getSessionStatus(): Promise<SessionStatus> {
    try {
      return await this.readFromSessionFile();
    } catch {
      return this.getFallback();
    }
  }

  private async readFromSessionFile(): Promise<SessionStatus> {
    const sessionsDir = path.join(os.homedir(), '.openclaw', 'agents', 'main', 'sessions');

    // Найти самый свежий .jsonl (не deleted, не .bak, не .lock)
    const files = fs.readdirSync(sessionsDir)
      .filter(f => f.endsWith('.jsonl') && !f.includes('deleted') && !f.includes('.bak') && !f.includes('.lock'))
      .map(f => ({
        name: f,
        mtime: fs.statSync(path.join(sessionsDir, f)).mtimeMs,
      }))
      .sort((a, b) => b.mtime - a.mtime);

    if (files.length === 0) throw new Error('No session files');

    const sessionFile = path.join(sessionsDir, files[0].name);

    // Читаем файл построчно, берём последнюю assistant usage
    let lastUsage: UsageData | null = null;
    let totalCacheRead = 0;
    let totalCacheWrite = 0;
    let model = 'claude-sonnet-4-6';

    const fileStream = fs.createReadStream(sessionFile);
    const rl = readline.createInterface({ input: fileStream, crlfDelay: Infinity });

    for await (const line of rl) {
      if (!line.trim()) continue;
      try {
        const record = JSON.parse(line);
        const msg = record?.message;
        if (msg?.role === 'assistant' && msg?.usage) {
          lastUsage = msg.usage;
          totalCacheRead += (msg.usage.cacheRead ?? 0);
          totalCacheWrite += (msg.usage.cacheWrite ?? 0);
          // Извлекаем модель если есть
          if (msg?.model) {
            model = (msg.model as string).replace('anthropic/', '').replace('claude-', 'claude-');
          }
        }
      } catch {
        // skip malformed lines
      }
    }

    if (!lastUsage) throw new Error('No usage data found');

    const contextUsed = (lastUsage.input ?? 0) + (lastUsage.cacheRead ?? 0) + (lastUsage.cacheWrite ?? 0);
    const contextWindow = 200_000;
    const percent = Math.round((contextUsed / contextWindow) * 100);

    const cacheTotal = totalCacheRead + totalCacheWrite;
    const cacheHitRate = cacheTotal > 0 ? Math.round((totalCacheRead / cacheTotal) * 100) : 0;

    return {
      tokensUsed: contextUsed,
      tokensTotal: contextWindow,
      tokensPercent: Math.min(percent, 100),
      model,
      cacheHitRate,
    };
  }

  private getFallback(): SessionStatus {
    return {
      tokensUsed: 0,
      tokensTotal: 200_000,
      tokensPercent: 0,
      model: 'claude-sonnet-4-6',
      cacheHitRate: 0,
    };
  }
}
