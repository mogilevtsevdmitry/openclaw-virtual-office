import { Injectable } from '@nestjs/common';
import * as fs from 'fs';
import * as path from 'path';

const OPENCLAW_DIR = '/root/.openclaw/agents';
const ACTIVE_THRESHOLD_MS = 5 * 60 * 1000; // 5 minutes = agent is WORKING

export interface AgentActivityStatus {
  agentId: string;    // openclaw agent id (main, finance, ...)
  isActive: boolean;
  lastSeenMs: number | null; // epoch ms of last activity
  presenceState: 'WORKING' | 'IDLE';
}

@Injectable()
export class OpenClawPresenceService {
  getActivityStatuses(): AgentActivityStatus[] {
    const results: AgentActivityStatus[] = [];

    if (!fs.existsSync(OPENCLAW_DIR)) return results;

    const agentDirs = fs.readdirSync(OPENCLAW_DIR).filter((d) => {
      return fs.statSync(path.join(OPENCLAW_DIR, d)).isDirectory();
    });

    for (const agentId of agentDirs) {
      const sessionsDir = path.join(OPENCLAW_DIR, agentId, 'sessions');
      if (!fs.existsSync(sessionsDir)) {
        results.push({ agentId, isActive: false, lastSeenMs: null, presenceState: 'IDLE' });
        continue;
      }

      // Find most recent .lock file → active session
      let lastSeenMs: number | null = null;
      let hasActiveLock = false;

      const files = fs.readdirSync(sessionsDir);
      for (const file of files) {
        if (!file.endsWith('.lock')) continue;
        const stat = fs.statSync(path.join(sessionsDir, file));
        const mtimeMs = stat.mtimeMs;
        if (lastSeenMs === null || mtimeMs > lastSeenMs) {
          lastSeenMs = mtimeMs;
        }
        if (Date.now() - mtimeMs < ACTIVE_THRESHOLD_MS) {
          hasActiveLock = true;
        }
      }

      // Also check .jsonl files for recent activity if no lock
      if (!hasActiveLock) {
        for (const file of files) {
          if (!file.endsWith('.jsonl') || file.includes('.deleted') || file.includes('.bak')) continue;
          const stat = fs.statSync(path.join(sessionsDir, file));
          const mtimeMs = stat.mtimeMs;
          if (lastSeenMs === null || mtimeMs > lastSeenMs) {
            lastSeenMs = mtimeMs;
          }
          if (Date.now() - mtimeMs < ACTIVE_THRESHOLD_MS) {
            hasActiveLock = true;
          }
        }
      }

      results.push({
        agentId,
        isActive: hasActiveLock,
        lastSeenMs,
        presenceState: hasActiveLock ? 'WORKING' : 'IDLE',
      });
    }

    return results;
  }
}
