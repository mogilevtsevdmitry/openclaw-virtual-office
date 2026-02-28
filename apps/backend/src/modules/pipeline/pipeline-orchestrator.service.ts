import { Injectable, Logger } from '@nestjs/common';
import { PrismaService } from '../../common/prisma/prisma.service';
import { StageStatus, PipelineStatus } from '@prisma/client';
import { exec } from 'child_process';
import { promisify } from 'util';

const execAsync = promisify(exec);
const TENANT_ID = 'tenant-smoke';

// Maps pipeline stage name → openclaw agentId
const STAGE_AGENT_MAP: Record<string, string> = {
  IDEA: 'ba',
  DISCOVERY: 'product',
  ARCHITECTURE: 'solution',
  PLANNING: 'techlead',
  BUILD: 'backend',
  QA: 'qa',
  SECURITY_GATE: 'security',
  DEPLOY: 'devops',
  PRODUCTION: 'devops',
};

// Human-readable task descriptions for each stage
const STAGE_TASK_PROMPTS: Record<string, string> = {
  IDEA: `Стадия IDEA активна. Прочитай PRD из артефактов. Если PRD ещё нет — задай Дмитрию уточняющие вопросы через sessions_send к agent:main:telegram:direct:400678398. После "можно" — напиши PRD. Сохрани через create-artifact.sh (type=PRD), заверши через complete-stage.sh IDEA.`,
  DISCOVERY: `Стадия DISCOVERY активна. Сделай market research (web_search), выяви конкурентов (3-5), составь MoSCoW-приоритизацию. Сохрани через create-artifact.sh (type=ADR, "DISCOVERY: Market Research"), заверши через complete-stage.sh DISCOVERY.`,
  ARCHITECTURE: `Стадия ARCHITECTURE активна. Прочитай PRD и DISCOVERY из артефактов проекта. Создай ADR: стек, C4 Context/Container диаграммы, структура репо, NFR checklist, топ-3 риска. Сохрани через create-artifact.sh (type=ADR, "ADR: Architecture Decisions"), заверши через complete-stage.sh ARCHITECTURE.`,
  PLANNING: `Стадия PLANNING активна. Прочитай PRD и ADR из артефактов. Составь sprint plan: декомпозиция по фазам, оценка в часах, порядок задач для Backend. Сохрани через create-artifact.sh (type=ADR, "PLANNING: Sprint Plan"), заверши через complete-stage.sh PLANNING.`,
  BUILD: `Стадия BUILD активна. Прочитай PLANNING артефакт — начни с задач первой фазы. Создай файлы в /root/projects/chronos-platform/, инициализируй git если нужно, коммить изменения. Сохрани RUNBOOK через create-artifact.sh (type=RUNBOOK, "BUILD: реализованные модули"), заверши через complete-stage.sh BUILD.`,
  QA: `Стадия QA активна. Прочитай RUNBOOK и PRD из артефактов. Составь test plan: unit тесты, API smoke tests, acceptance criteria. Проверь что все AC из PRD покрыты. Сохрани через create-artifact.sh (type=TEST_REPORT, "QA: Test Report"), заверши через complete-stage.sh QA.`,
  SECURITY_GATE: `Стадия SECURITY_GATE активна. Проверь: открытые endpoints, rate limiting, input validation, HTTPS, SQL injection, dependency vulnerabilities. Сохрани через create-artifact.sh (type=THREAT_MODEL, "Security: Threat Model"), заверши через complete-stage.sh SECURITY_GATE.`,
  DEPLOY: `Стадия DEPLOY активна. Прочитай RUNBOOK. Опиши Docker Compose конфигурацию, nginx, SSL, CI/CD pipeline, команды деплоя на VPS. Сохрани через create-artifact.sh (type=DEPLOY_RECORD, "DEPLOY: Deployment Record"), заверши через complete-stage.sh DEPLOY.`,
  PRODUCTION: `Стадия PRODUCTION активна. Финальная проверка: health check endpoint, smoke test продакшена, rollback plan. Сохрани через create-artifact.sh (type=POSTMORTEM, "PRODUCTION: Final Report"), заверши через complete-stage.sh PRODUCTION.`,
};

const STAGE_TIMEOUTS: Record<string, number> = {
  IDEA: 180,
  DISCOVERY: 240,
  ARCHITECTURE: 240,
  PLANNING: 120,
  BUILD: 300,
  QA: 180,
  SECURITY_GATE: 180,
  DEPLOY: 180,
  PRODUCTION: 120,
};

@Injectable()
export class PipelineOrchestratorService {
  private readonly logger = new Logger(PipelineOrchestratorService.name);

  constructor(private readonly prisma: PrismaService) {}

  /**
   * Called after a stage transitions to COMPLETED/SKIPPED.
   * Finds the next PENDING stage, activates it, and spawns the owner agent.
   * Runs async (non-blocking) via setImmediate.
   */
  advanceAfterComplete(runId: string, completedStage: string): void {
    // Non-blocking: respond to HTTP immediately, advance in background
    setImmediate(() => {
      this.doAdvance(runId, completedStage).catch((err) => {
        this.logger.error(`[orchestrator] advance failed for run ${runId}: ${err.message}`);
      });
    });
  }

  private async doAdvance(runId: string, completedStage: string): Promise<void> {
    this.logger.log(`[orchestrator] advancing run ${runId} after ${completedStage}`);

    // 1. Check run is still RUNNING
    const run = await this.prisma.pipelineRun.findUnique({
      where: { id: runId },
      include: { project: true },
    });
    if (!run || run.status === PipelineStatus.COMPLETED || run.status === PipelineStatus.FAILED) {
      this.logger.log(`[orchestrator] run ${runId} already terminal (${run?.status}) — skipping`);
      return;
    }

    // 2. Find next PENDING stage (lowest stageOrder)
    const nextStage = await this.prisma.pipelineStage.findFirst({
      where: { runId, status: StageStatus.PENDING },
      orderBy: { stageOrder: 'asc' },
    });

    if (!nextStage) {
      this.logger.log(`[orchestrator] no pending stages for run ${runId} — pipeline complete`);
      return;
    }

    // 3. Activate the next stage
    await this.prisma.$transaction([
      this.prisma.pipelineStage.update({
        where: { runId_stageName: { runId, stageName: nextStage.stageName } },
        data: { status: StageStatus.ACTIVE, startedAt: new Date() },
      }),
      this.prisma.pipelineRun.update({
        where: { id: runId },
        data: { currentStage: nextStage.stageName },
      }),
    ]);

    this.logger.log(`[orchestrator] activated ${nextStage.stageName} for run ${runId}`);

    // 4. Spawn the owner agent via openclaw CLI
    const agentId = STAGE_AGENT_MAP[nextStage.stageName] ?? nextStage.ownerAgent;
    const taskPrompt = STAGE_TASK_PROMPTS[nextStage.stageName];
    const timeout = STAGE_TIMEOUTS[nextStage.stageName] ?? 180;

    if (!taskPrompt) {
      this.logger.warn(`[orchestrator] no task prompt for stage ${nextStage.stageName} — skipping spawn`);
      return;
    }

    const projectName = run.project?.name ?? run.id;
    const fullPrompt = [
      `Ты — агент ${agentId} в AI-компании OpenClaw.`,
      `ПРОЕКТ: ${projectName}`,
      `Project ID: ${run.projectId}`,
      `Run ID: ${runId}`,
      ``,
      taskPrompt,
      ``,
      `Скрипты:`,
      `  create-artifact: bash /root/scripts/agent-tools/create-artifact.sh <projectId> <runId> <type> <title> tenant-smoke "<content>"`,
      `  complete-stage:  bash /root/scripts/agent-tools/complete-stage.sh ${runId} ${nextStage.stageName} tenant-smoke`,
      ``,
      `Выведи DONE когда завершено.`,
    ].join('\n');

    await this.spawnAgent(agentId, fullPrompt, timeout, runId, nextStage.stageName);
  }

  private async spawnAgent(
    agentId: string,
    prompt: string,
    timeoutSeconds: number,
    runId: string,
    stageName: string,
  ): Promise<void> {
    // Write prompt to a temp file to avoid shell escaping issues
    const tmpFile = `/tmp/pipeline-prompt-${runId}-${stageName}.txt`;
    const escapedPrompt = prompt.replace(/'/g, "'\\''");

    const cmd = [
      `echo '${escapedPrompt}' > ${tmpFile}`,
      `&&`,
      `openclaw sessions spawn`,
      `--agent ${agentId}`,
      `--mode run`,
      `--run-timeout ${timeoutSeconds}`,
      `--task "$(cat ${tmpFile})"`,
      `--cleanup keep`,
      `2>&1 || true`,
    ].join(' ');

    this.logger.log(`[orchestrator] spawning agent ${agentId} for stage ${stageName} (timeout ${timeoutSeconds}s)`);

    try {
      const { stdout, stderr } = await execAsync(cmd, { timeout: 10_000 });
      this.logger.log(`[orchestrator] spawn result: ${stdout.slice(0, 200)}`);
      if (stderr) this.logger.warn(`[orchestrator] spawn stderr: ${stderr.slice(0, 200)}`);
    } catch (err: unknown) {
      const error = err as Error;
      this.logger.error(`[orchestrator] spawn failed: ${error.message}`);
    }
  }
}
