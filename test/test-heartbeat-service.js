import fs from "fs/promises";
import os from "os";
import path from "path";
import { HeartbeatService } from "../src/heartbeat/heartbeat-service.js";
import { HeartbeatMode, HeartbeatModeStore } from "../src/heartbeat/heartbeat-mode.js";
import { LifecycleProposalStore } from "../src/heartbeat/lifecycle-proposal-store.js";
import { HeartbeatLifecyclePolicy } from "../src/heartbeat/lifecycle-policy-service.js";
import { CradleSnapshotService } from "../src/heartbeat/cradle-snapshot-service.js";
import { ThreatStore } from "../src/heartbeat/threat-store.js";
import { ArtifactExecutionService } from "../src/execution/artifact-execution-service.js";
import { ExecutionResult } from "../src/execution/execution-result.js";
import { decideCellLifecycle } from "../src/dna/dna-lifecycle.js";

console.log("=== Heartbeat Service Tests ===\n");

let passed = 0;
let failed = 0;

async function test(name, fn) {
  try {
    await fn();
    passed++;
    console.log(`✓ ${name}`);
  } catch (error) {
    failed++;
    console.error(`✗ ${name}`);
    console.error(`  ${error.message}`);
  }
}

function assert(condition, message) {
  if (!condition) {
    throw new Error(message || "Assertion failed");
  }
}

class FakeCell {
  constructor(id, proposal = null) {
    this.id = id;
    this.proposal = proposal || {
      proposalId: `proposal-${id}`,
      createdAt: new Date().toISOString(),
      sourceCellId: id,
      action: "stay",
      targetCellIds: [],
      suggestedChildId: null,
      reason: "stay",
      evidence: [],
      confidence: 0.3,
      status: "pending",
    };
    this.observeCalls = 0;
    this.lifecycleDecisionCalls = 0;
    this.directMutations = 0;
    this.artifactStore = {
      async listArtifactSummaries() {
        return { artifacts: [], errors: [] };
      }
    };
  }

  async readCellProfile() {
    return { status: "idle", relationships: [] };
  }

  async readLivingContext() {
    return { purpose: `${this.id} purpose`, responsibilities: ["test"], owns: [] };
  }

  async getMaturityInfo() {
    return { maturity: 0.9, percent: 90, state: "mature", convergence: 1 };
  }

  async getLifecycleDecision() {
    this.lifecycleDecisionCalls++;
    return { action: this.proposal.action, confidence: "high", reason: this.proposal.reason };
  }

  async readDNAVector() {
    return {};
  }

  async listRelationships() {
    return [];
  }

  async readTasks() {
    return [];
  }

  async observeCradle(snapshot) {
    this.observeCalls++;
    return {
      observationId: `obs-${this.id}`,
      observedAt: snapshot.observedAt,
      observerCellId: this.id,
      self: { maturity: await this.getMaturityInfo(), stability: 1, recentFailures: [] },
      findings: [],
      candidateActions: [this.proposal.action],
    };
  }

  async proposeLifecycle() {
    return this.proposal;
  }

  async writeDNAVector() {
    this.directMutations++;
  }

  async writeLivingContext() {
    this.directMutations++;
  }
}

class FakeEngine {
  constructor(cells = []) {
    this.cells = new Map(cells.map((cell) => [cell.id, cell]));
  }

  listCells() {
    return [...this.cells.values()];
  }

  listCellIds() {
    return [...this.cells.keys()];
  }

  hasCell(id) {
    return this.cells.has(id);
  }

  getCell(id) {
    return this.cells.get(id) || null;
  }

  requireCell(id) {
    const cell = this.getCell(id);
    if (!cell) throw new Error(`missing cell ${id}`);
    return cell;
  }
}

class FakeExecutionService {
  constructor() {
    this.calls = [];
  }

  async execute(proposal) {
    this.calls.push(proposal);
    if (proposal.fail) {
      return { status: "failed", action: proposal.action, errorStage: "test", errorMessage: "boom", failedAt: new Date().toISOString() };
    }
    return { status: "completed", action: proposal.action, startedAt: new Date().toISOString(), completedAt: new Date().toISOString() };
  }
}

const tmp = await fs.mkdtemp(path.join(os.tmpdir(), "cradle-heartbeat-test-"));

try {
  await test("default mode is manual", async () => {
    const store = new HeartbeatModeStore({ file: path.join(tmp, "runtime-default.json") });
    assert((await store.getMode()) === HeartbeatMode.MANUAL);
  });

  await test("mode can switch and persists", async () => {
    const file = path.join(tmp, "runtime-persist.json");
    const store = new HeartbeatModeStore({ file });
    await store.setMode(HeartbeatMode.AUTOMATIC);
    const reloaded = new HeartbeatModeStore({ file });
    assert((await reloaded.getMode()) === HeartbeatMode.AUTOMATIC);
  });

  await test("invalid mode is rejected", async () => {
    const store = new HeartbeatModeStore({ file: path.join(tmp, "runtime-invalid.json") });
    let threw = false;
    try {
      await store.setMode("invalid");
    } catch {
      threw = true;
    }
    assert(threw);
  });

  await test("manual divide yes calls execution service", async () => {
    const cell = new FakeCell("cell-001", {
      proposalId: "proposal-divide",
      sourceCellId: "cell-001",
      action: "divide",
      targetCellIds: [],
      suggestedChildId: "cell-002",
      reason: "ready",
      evidence: [{ type: "maturity", value: { maturity: 0.9 } }],
      confidence: 0.9,
      status: "pending",
    });
    const execution = new FakeExecutionService();
    const result = await new HeartbeatService({
      engine: new FakeEngine([cell]),
      modeStore: { async getMode() { return HeartbeatMode.MANUAL; } },
      proposalStore: new LifecycleProposalStore({ dir: path.join(tmp, "manual-yes") }),
      executionService: execution,
      approvalService: { async requestApproval() { return true; } },
    }).beat();

    assert(execution.calls.length === 1);
    assert(result.selected.proposal.status === "completed");
  });

  await test("manual divide no rejects without execution", async () => {
    const cell = new FakeCell("cell-001", {
      proposalId: "proposal-divide-no",
      sourceCellId: "cell-001",
      action: "divide",
      targetCellIds: [],
      suggestedChildId: "cell-002",
      reason: "ready",
      evidence: [{ type: "maturity", value: { maturity: 0.9 } }],
      confidence: 0.9,
      status: "pending",
    });
    const execution = new FakeExecutionService();
    const result = await new HeartbeatService({
      engine: new FakeEngine([cell]),
      modeStore: { async getMode() { return HeartbeatMode.MANUAL; } },
      proposalStore: new LifecycleProposalStore({ dir: path.join(tmp, "manual-no") }),
      executionService: execution,
      approvalService: { async requestApproval() { return false; } },
    }).beat();

    assert(execution.calls.length === 0);
    assert(result.selected.proposal.status === "rejected");
  });

  await test("manual fuse yes calls execution service", async () => {
    const cellA = new FakeCell("cell-001", {
      proposalId: "proposal-fuse",
      sourceCellId: "cell-001",
      action: "fuse",
      targetCellIds: ["cell-002"],
      suggestedChildId: "cell-003",
      reason: "compatible cells",
      evidence: [],
      confidence: 0.8,
      status: "pending",
    });
    const cellB = new FakeCell("cell-002");
    const execution = new FakeExecutionService();

    const result = await new HeartbeatService({
      engine: new FakeEngine([cellA, cellB]),
      modeStore: { async getMode() { return HeartbeatMode.MANUAL; } },
      proposalStore: new LifecycleProposalStore({ dir: path.join(tmp, "manual-fuse") }),
      executionService: execution,
      approvalService: { async requestApproval() { return true; } },
    }).beat();

    assert(execution.calls.length === 1);
    assert(result.selected.proposal.status === "completed");
  });

  await test("manual artifact repair no does not execute", async () => {
    const cell = new FakeCell("cell-001", {
      proposalId: "proposal-repair-no",
      sourceCellId: "cell-001",
      action: "repair",
      repairType: "artifact",
      targetCellIds: [],
      artifactId: "artifact-001",
      reason: "needs repair",
      evidence: [],
      confidence: 0.7,
      status: "pending",
    });
    const execution = new FakeExecutionService();

    const result = await new HeartbeatService({
      engine: new FakeEngine([cell]),
      modeStore: { async getMode() { return HeartbeatMode.MANUAL; } },
      proposalStore: new LifecycleProposalStore({ dir: path.join(tmp, "manual-repair-no") }),
      executionService: execution,
      approvalService: { async requestApproval() { return false; } },
    }).beat();

    assert(execution.calls.length === 0);
    assert(result.selected.proposal.status === "rejected");
  });

  await test("blocked divide does not ask approval or become selected", async () => {
    const cell = new FakeCell("cell-001", {
      proposalId: "proposal-blocked",
      sourceCellId: "cell-001",
      action: "divide",
      targetCellIds: [],
      suggestedChildId: "cell-002",
      reason: "not ready",
      evidence: [{ type: "maturity", value: { maturity: 0.05 } }],
      confidence: 0.9,
      status: "pending",
    });
    let approvalCalls = 0;
    const result = await new HeartbeatService({
      engine: new FakeEngine([cell]),
      modeStore: { async getMode() { return HeartbeatMode.MANUAL; } },
      proposalStore: new LifecycleProposalStore({ dir: path.join(tmp, "blocked") }),
      executionService: new FakeExecutionService(),
      approvalService: { async requestApproval() { approvalCalls++; return true; } },
    }).beat();

    assert(approvalCalls === 0);
    assert(result.action === "stay");
    assert(!result.selected);
    assert(result.saved.some((item) => item.record.proposal.status === "blocked"));
  });

  await test("automatic allowed divide executes", async () => {
    const cell = new FakeCell("cell-001", {
      proposalId: "proposal-auto-divide",
      sourceCellId: "cell-001",
      action: "divide",
      targetCellIds: [],
      suggestedChildId: "cell-002",
      reason: "ready",
      evidence: [{ type: "maturity", value: { maturity: 0.9 } }],
      confidence: 0.9,
      status: "pending",
    });
    const execution = new FakeExecutionService();
    await new HeartbeatService({
      engine: new FakeEngine([cell]),
      modeStore: { async getMode() { return HeartbeatMode.AUTOMATIC; } },
      proposalStore: new LifecycleProposalStore({ dir: path.join(tmp, "auto-divide") }),
      executionService: execution,
    }).beat();

    assert(execution.calls.length === 1);
  });

  await test("automatic allowed artifact repair executes", async () => {
    const cell = new FakeCell("cell-001", {
      proposalId: "proposal-auto-repair",
      sourceCellId: "cell-001",
      action: "repair",
      repairType: "artifact",
      targetCellIds: [],
      artifactId: "artifact-001",
      reason: "repair artifact",
      evidence: [],
      confidence: 0.7,
      status: "pending",
    });
    const execution = new FakeExecutionService();

    await new HeartbeatService({
      engine: new FakeEngine([cell]),
      modeStore: { async getMode() { return HeartbeatMode.AUTOMATIC; } },
      proposalStore: new LifecycleProposalStore({ dir: path.join(tmp, "auto-repair") }),
      executionService: execution,
    }).beat();

    assert(execution.calls.length === 1);
  });

  await test("automatic allowed but requires approval falls back to yes/no", async () => {
    const cell = new FakeCell("cell-001", {
      proposalId: "proposal-auto-approval",
      sourceCellId: "cell-001",
      action: "divide",
      targetCellIds: [],
      suggestedChildId: "cell-002",
      reason: "ready with warning",
      evidence: [{ type: "maturity", value: { maturity: 0.9 } }],
      confidence: 0.9,
      status: "pending",
    });
    const execution = new FakeExecutionService();
    let approvalCalls = 0;

    await new HeartbeatService({
      engine: new FakeEngine([cell]),
      modeStore: { async getMode() { return HeartbeatMode.AUTOMATIC; } },
      proposalStore: new LifecycleProposalStore({ dir: path.join(tmp, "auto-approval") }),
      policy: {
        async evaluate(proposal) {
          return {
            allowed: true,
            action: proposal.action,
            reasons: [],
            warnings: ["readiness is marginal"],
            riskLevel: "high",
            requiresApproval: true,
          };
        },
      },
      executionService: execution,
      approvalService: { async requestApproval() { approvalCalls++; return true; } },
    }).beat();

    assert(approvalCalls === 1);
    assert(execution.calls.length === 1);
  });

  await test("execution failure marks proposal failed", async () => {
    const cell = new FakeCell("cell-001", {
      proposalId: "proposal-fail",
      sourceCellId: "cell-001",
      action: "divide",
      targetCellIds: [],
      suggestedChildId: "cell-002",
      reason: "ready",
      evidence: [{ type: "maturity", value: { maturity: 0.9 } }],
      confidence: 0.9,
      fail: true,
      status: "pending",
    });
    const result = await new HeartbeatService({
      engine: new FakeEngine([cell]),
      modeStore: { async getMode() { return HeartbeatMode.AUTOMATIC; } },
      proposalStore: new LifecycleProposalStore({ dir: path.join(tmp, "fail") }),
      executionService: new FakeExecutionService(),
    }).beat();

    assert(result.selected.proposal.status === "failed");
  });

  await test("snapshot includes all cells and does not mutate cells", async () => {
    const cellA = new FakeCell("cell-001");
    const cellB = new FakeCell("cell-002");
    const engine = new FakeEngine([cellA, cellB]);
    const snapshot = await new CradleSnapshotService({ engine, situationDir: path.join(tmp, "situation") }).create();

    snapshot.cells[0].cellId = "mutated";

    assert(snapshot.cells.length === 2);
    assert(engine.getCell("cell-001").id === "cell-001");
  });

  await test("threat store saves and lists unresolved execution failures by cell", async () => {
    const threatStore = new ThreatStore({
      dir: path.join(tmp, "threat-store", "threats"),
    });
    const threat = await threatStore.saveExecutionFailure({
      cellId: "cell-003",
      artifactId: "artifact-001",
      executionResult: ExecutionResult.createCompileFailed({
        artifactId: "artifact-001",
        command: "javac Main.java",
        stderr: "compile failed",
        executionId: "execution-001",
      }),
    });

    const cellThreats = await threatStore.listUnresolvedForCell("cell-003");
    const otherThreats = await threatStore.listUnresolvedForCell("cell-004");

    assert(threat.type === "artifact-execution-failure");
    assert(threat.cellId === "cell-003");
    assert(threat.artifactId === "artifact-001");
    assert(threat.executionId === "execution-001");
    assert(cellThreats.length === 1);
    assert(otherThreats.length === 0);
  });

  await test("threat store deduplicates execution id and lists newest first", async () => {
    const threatStore = new ThreatStore({
      dir: path.join(tmp, "threat-store-order", "threats"),
    });
    const older = await threatStore.saveExecutionFailure({
      cellId: "cell-003",
      artifactId: "artifact-001",
      executionResult: new ExecutionResult({
        artifactId: "artifact-001",
        status: "compile_failed",
        command: "javac Main.java",
        stderr: "older",
        executionId: "execution-001",
        createdAt: "2026-07-17T01:00:00.000Z",
      }),
    });
    const duplicate = await threatStore.saveExecutionFailure({
      cellId: "cell-003",
      artifactId: "artifact-001",
      executionResult: new ExecutionResult({
        artifactId: "artifact-001",
        status: "compile_failed",
        command: "javac Main.java",
        stderr: "duplicate",
        executionId: "execution-001",
        createdAt: "2026-07-17T03:00:00.000Z",
      }),
    });
    const newer = await threatStore.saveExecutionFailure({
      cellId: "cell-003",
      artifactId: "artifact-002",
      executionResult: new ExecutionResult({
        artifactId: "artifact-002",
        status: "runtime_failed",
        command: "java Main",
        stderr: "newer",
        executionId: "execution-002",
        createdAt: "2026-07-17T02:00:00.000Z",
      }),
    });

    const threats = await threatStore.listUnresolvedForCell("cell-003");

    assert(duplicate.threatId === older.threatId);
    assert(threats.length === 2);
    assert(threats[0].threatId === newer.threatId);
    assert(threats[1].threatId === older.threatId);
  });

  await test("dna lifecycle repair details separate artifact and dna signals", async () => {
    const artifactDecision = decideCellLifecycle({
      maturityInfo: {
        sampleSize: 5,
        temporalVariance: 0.05,
      },
      recentFailureRate: 1,
    });
    const dnaDecision = decideCellLifecycle({
      maturityInfo: {
        sampleSize: 5,
        temporalVariance: 0.25,
      },
      recentFailureRate: 0,
    });

    assert(artifactDecision.action === "repair");
    assert(artifactDecision.reason === "recent artifact execution failures detected");
    assert(artifactDecision.detail.repairSignals.artifactFailures === true);
    assert(artifactDecision.detail.repairSignals.dnaUnstable === false);
    assert(dnaDecision.action === "repair");
    assert(dnaDecision.reason === "dna vector is unstable");
    assert(dnaDecision.detail.repairSignals.dnaUnstable === true);
    assert(dnaDecision.detail.repairSignals.artifactFailures === false);
  });

  await test("artifact execution failure creates structured threat", async () => {
    const threatStore = new ThreatStore({
      dir: path.join(tmp, "execution-threats", "threats"),
    });
    const service = new ArtifactExecutionService({
      cellId: "cell-003",
      productionsDir: path.join(tmp, "productions"),
      executionsDir: path.join(tmp, "executions"),
      threatStore,
    });

    service.artifactStore = {
      async readArtifact() {
        return {
          id: "artifact-001",
          type: "executable-java",
          outputs: [],
        };
      },
    };
    service.selectExecutor = () => ({
      async execute({ artifact }) {
        return ExecutionResult.createCompileFailed({
          artifactId: artifact.id,
          command: "javac Main.java",
          stderr: "compile failed",
          executionId: "execution-001",
        });
      },
    });

    const result = await service.executeArtifact("artifact-001");
    const threats = await threatStore.listUnresolvedForCell("cell-003");

    assert(result.status === "compile_failed");
    assert(threats.length === 1);
    assert(threats[0].cellId === "cell-003");
    assert(threats[0].artifactId === "artifact-001");
    assert(threats[0].executionId === "execution-001");
    assert(threats[0].status === "compile_failed");
  });

  await test("snapshot reads unresolved threats without lifecycle decisions", async () => {
    const threatStore = new ThreatStore({
      dir: path.join(tmp, "snapshot-threats", "threats"),
    });
    await threatStore.saveExecutionFailure({
      cellId: "cell-001",
      artifactId: "artifact-001",
      executionResult: ExecutionResult.createRuntimeFailed({
        artifactId: "artifact-001",
        command: "java Main",
        stdout: "",
        stderr: "runtime failed",
        exitCode: 1,
        executionId: "execution-001",
      }),
    });

    const cellA = new FakeCell("cell-001");
    const cellB = new FakeCell("cell-002");
    const snapshot = await new CradleSnapshotService({
      engine: new FakeEngine([cellA, cellB]),
      situationDir: path.join(tmp, "snapshot-threats"),
      threatStore,
    }).create();

    const cellASnapshot = snapshot.cells.find((cell) => cell.cellId === "cell-001");
    const cellBSnapshot = snapshot.cells.find((cell) => cell.cellId === "cell-002");

    assert(cellA.lifecycleDecisionCalls === 0);
    assert(cellB.lifecycleDecisionCalls === 0);
    assert(cellASnapshot.threatCount === 1);
    assert(cellASnapshot.recentFailures[0].artifactId === "artifact-001");
    assert(cellBSnapshot.threatCount === 0);
  });

  await test("cell observation is called by heartbeat", async () => {
    const cell = new FakeCell("cell-001");
    await new HeartbeatService({
      engine: new FakeEngine([cell]),
      modeStore: { async getMode() { return HeartbeatMode.AUTOMATIC; } },
      proposalStore: new LifecycleProposalStore({ dir: path.join(tmp, "observe") }),
      executionService: new FakeExecutionService(),
    }).beat();

    assert(cell.observeCalls === 1);
  });

  await test("unknown fuse target is blocked", async () => {
    const policy = new HeartbeatLifecyclePolicy({ engine: new FakeEngine([new FakeCell("cell-001")]) });
    const decision = await policy.evaluate({
      sourceCellId: "cell-001",
      action: "fuse",
      targetCellIds: ["missing"],
      suggestedChildId: "cell-003",
    });

    assert(decision.allowed === false);
  });

  await test("one high-risk proposal handled per heartbeat and others remain pending", async () => {
    const cellA = new FakeCell("cell-001", {
      proposalId: "proposal-a",
      sourceCellId: "cell-001",
      action: "divide",
      targetCellIds: [],
      suggestedChildId: "cell-003",
      reason: "a",
      evidence: [{ type: "maturity", value: { maturity: 0.9 } }],
      confidence: 0.9,
      status: "pending",
    });
    const cellB = new FakeCell("cell-002", {
      proposalId: "proposal-b",
      sourceCellId: "cell-002",
      action: "divide",
      targetCellIds: [],
      suggestedChildId: "cell-004",
      reason: "b",
      evidence: [{ type: "maturity", value: { maturity: 0.9 } }],
      confidence: 0.8,
      status: "pending",
    });
    const dir = path.join(tmp, "one-risk");
    const store = new LifecycleProposalStore({ dir });
    const execution = new FakeExecutionService();

    await new HeartbeatService({
      engine: new FakeEngine([cellA, cellB]),
      modeStore: { async getMode() { return HeartbeatMode.AUTOMATIC; } },
      proposalStore: store,
      executionService: execution,
    }).beat();

    const records = await store.list();
    assert(execution.calls.length === 1);
    assert(records.some((record) => record.proposal?.status === "pending"));
  });

  await test("heartbeat does not directly mutate dna or living context", async () => {
    const cell = new FakeCell("cell-001");
    await new HeartbeatService({
      engine: new FakeEngine([cell]),
      modeStore: { async getMode() { return HeartbeatMode.AUTOMATIC; } },
      proposalStore: new LifecycleProposalStore({ dir: path.join(tmp, "no-mutation") }),
      executionService: new FakeExecutionService(),
    }).beat();

    assert(cell.directMutations === 0);
  });
} finally {
  await fs.rm(tmp, { recursive: true, force: true });
}

console.log(`\nPassed: ${passed}`);
console.log(`Failed: ${failed}`);

if (failed > 0) {
  process.exit(1);
}
