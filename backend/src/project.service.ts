import { randomUUID } from "crypto";
import { Injectable, NotFoundException } from "@nestjs/common";
import { Prisma, SpecIteration } from "@prisma/client";
import { DecisionService } from "./decision.service";
import { DependencyGraphService } from "./dependency-graph.service";
import { PrismaService } from "./prisma.service";

export type SpecData = Record<string, unknown>;

@Injectable()
export class ProjectService {
  constructor(
    private readonly prisma: PrismaService,
    private readonly dependencyGraph: DependencyGraphService,
    private readonly decisions: DecisionService,
  ) {}

  async create(title: string): Promise<{ id: string; title: string }> {
    return this.prisma.researchProject.create({
      data: { title },
      select: { id: true, title: true },
    });
  }

  async list() {
    const projects = await this.prisma.researchProject.findMany({
      orderBy: { updatedAt: 'desc' },
      include: { latestSpec: { select: { id: true, version: true, createdAt: true } } },
    });
    return projects.map((p) => ({
      id: p.id,
      title: p.title,
      createdAt: p.createdAt.toISOString(),
      updatedAt: p.updatedAt.toISOString(),
      latestSpec: p.latestSpec
        ? { id: p.latestSpec.id, version: p.latestSpec.version, createdAt: p.latestSpec.createdAt.toISOString() }
        : null,
    }));
  }

  async latestSpec(projectId: string): Promise<SpecIteration> {
    const project = await this.prisma.researchProject.findUnique({
      where: { id: projectId },
      include: { latestSpec: true },
    });
    if (!project?.latestSpec) {
      throw new NotFoundException(
        `No latest spec exists for project ${projectId}`,
      );
    }
    return project.latestSpec;
  }

  async history(projectId: string) {
    const project = await this.prisma.researchProject.findUnique({
      where: { id: projectId },
      select: { id: true, title: true, specs: { orderBy: { version: "asc" } } },
    });
    if (!project)
      throw new NotFoundException(`Project ${projectId} was not found`);
    return {
      project: { id: project.id, title: project.title },
      specs: project.specs.map((spec) => ({
        id: spec.id,
        version: spec.version,
        data: spec.data,
        createdAt: spec.createdAt.toISOString(),
      })),
    };
  }

  async summary(projectId: string) {
    const project = await this.prisma.researchProject.findUnique({
      where: { id: projectId },
      include: {
        latestSpec: { include: { cards: { orderBy: { createdAt: "asc" } } } },
        cardLinks: { orderBy: { createdAt: "asc" } },
        decisions: { orderBy: { createdAt: "asc" } },
        runs: { orderBy: { updatedAt: "desc" }, take: 10 },
        clarification: true,
      },
    });
    if (!project)
      throw new NotFoundException(`Project ${projectId} was not found`);
    const confirmations = await this.prisma.confirmationQuestion.findMany({
      where: { projectId },
      orderBy: { createdAt: "asc" },
    });
    return {
      project: { id: project.id, title: project.title },
      latestSpec: project.latestSpec
        ? {
            id: project.latestSpec.id,
            version: project.latestSpec.version,
            data: project.latestSpec.data,
            createdAt: project.latestSpec.createdAt.toISOString(),
          }
        : null,
      cards: project.latestSpec?.cards ?? [],
      links: project.latestSpec
        ? project.cardLinks.filter(
            (link) => link.specIterationId === project.latestSpec?.id,
          )
        : [],
      decisions: project.decisions,
      confirmations,
      workflows: project.runs,
      clarification: project.clarification,
    };
  }

  async createSpec(
    projectId: string,
    data: SpecData,
    idempotencyKey?: string,
  ): Promise<SpecIteration> {
    return this.prisma.$transaction(async (transaction) => {
      if (idempotencyKey) {
        const previous = await transaction.idempotencyRecord.findUnique({
          where: { projectId_key: { projectId, key: idempotencyKey } },
        });
        if (previous) return previous.result as unknown as SpecIteration;
      }
      const project = await transaction.researchProject.findUnique({
        where: { id: projectId },
        include: { latestSpec: true },
      });
      if (!project)
        throw new NotFoundException(`Project ${projectId} was not found`);
      const version = (project.latestSpec?.version ?? 0) + 1;
      const spec = await transaction.specIteration.create({
        data: { projectId, version, data: data as Prisma.InputJsonValue },
      });
      await transaction.researchProject.update({
        where: { id: projectId },
        data: { latestSpecId: spec.id },
      });
      if (project.latestSpec) {
        await this.cloneVersionData(
          transaction,
          projectId,
          project.latestSpec.id,
          spec.id,
        );
      }
      if (idempotencyKey) {
        await transaction.idempotencyRecord.create({
          data: {
            projectId,
            key: idempotencyKey,
            operation: "create-spec",
            result: spec as unknown as Prisma.InputJsonValue,
          },
        });
      }
      return spec;
    });
  }

  async updateNode(
    projectId: string,
    node: string,
    value: unknown,
    idempotencyKey?: string,
  ): Promise<SpecIteration> {
    return this.prisma.$transaction(async (transaction) => {
      if (idempotencyKey) {
        const previous = await transaction.idempotencyRecord.findUnique({
          where: { projectId_key: { projectId, key: idempotencyKey } },
        });
        if (previous) return previous.result as unknown as SpecIteration;
      }
      const project = await transaction.researchProject.findUnique({
        where: { id: projectId },
        include: { latestSpec: true },
      });
      if (!project?.latestSpec)
        throw new NotFoundException(
          `No latest spec exists for project ${projectId}`,
        );
      const current = project.latestSpec;
      const currentData = current.data as SpecData;
      const dataKey = this.dataKeyForNode(node);
      // experimentPlan is the only deeply-nested data key — shallow overwrite
      // would drop nested properties not included in `value`. Deep-merge it so
      // contributions/experiments/feasibility survive partial updates.
      const nextData =
        dataKey === "experimentPlan"
          ? {
              ...currentData,
              [dataKey]: {
                ...((currentData[dataKey] as object) ?? {}),
                ...((value as object) ?? {}),
              },
            }
          : { ...currentData, [dataKey]: value };
      const spec = await transaction.specIteration.create({
        data: {
          projectId,
          version: current.version + 1,
          data: nextData as Prisma.InputJsonValue,
        },
      });
      await transaction.researchProject.update({
        where: { id: projectId },
        data: { latestSpecId: spec.id },
      });
      await this.cloneVersionData(
        transaction,
        projectId,
        current.id,
        spec.id,
      );
      if (this.dependencyGraph.isValidNode(node)) {
        const affectedNodes = this.dependencyGraph.getAffectedNodes(node);
        for (const affectedNode of affectedNodes) {
          await transaction.specArtifact.upsert({
            where: {
              specIterationId_node: {
                specIterationId: spec.id,
                node: affectedNode,
              },
            },
            create: {
              projectId,
              specIterationId: spec.id,
              node: affectedNode,
              status: "STALE",
              data: {},
            },
            update: { status: "STALE" },
          });
        }
      }
      if (idempotencyKey) {
        await transaction.idempotencyRecord.create({
          data: {
            projectId,
            key: idempotencyKey,
            operation: `update-node:${node}`,
            result: spec as unknown as Prisma.InputJsonValue,
          },
        });
      }
      return spec;
    });
  }

  async addRelatedWork(
    projectId: string,
    input: {
      title: string;
      sourceUrl?: string;
      year?: string;
      whatItDid?: string;
      feedbackType?: string;
      missingGap?: string;
      sourceType?: string;
    },
    idempotencyKey?: string,
  ): Promise<SpecIteration> {
    return this.prisma.$transaction(async (transaction) => {
      if (idempotencyKey) {
        const previous = await transaction.idempotencyRecord.findUnique({
          where: { projectId_key: { projectId, key: idempotencyKey } },
        });
        if (previous) return previous.result as unknown as SpecIteration;
      }
      const project = await transaction.researchProject.findUnique({
        where: { id: projectId },
        include: { latestSpec: true },
      });
      if (!project?.latestSpec)
        throw new NotFoundException(
          `No latest spec exists for project ${projectId}`,
        );
      const current = project.latestSpec;
      const currentData = current.data as SpecData;
      const existing = this.asRelatedWorkArray(currentData.relatedWork);
      const item = this.toRelatedWorkItem(input);
      const isDuplicate = existing.some((entry) =>
        this.sameRelatedWork(entry, item),
      );
      if (isDuplicate) {
        return current;
      }
      const nextData = { ...currentData, relatedWork: [...existing, item] };
      const spec = await transaction.specIteration.create({
        data: {
          projectId,
          version: current.version + 1,
          data: nextData as Prisma.InputJsonValue,
        },
      });
      await transaction.researchProject.update({
        where: { id: projectId },
        data: { latestSpecId: spec.id },
      });
      await this.cloneVersionData(
        transaction,
        projectId,
        current.id,
        spec.id,
      );
      const affectedNodes =
        this.dependencyGraph.getAffectedNodes("related_work");
      for (const affectedNode of affectedNodes) {
        await transaction.specArtifact.upsert({
          where: {
            specIterationId_node: {
              specIterationId: spec.id,
              node: affectedNode,
            },
          },
          create: {
            projectId,
            specIterationId: spec.id,
            node: affectedNode,
            status: "STALE",
            data: {},
          },
          update: { status: "STALE" },
        });
      }
      await this.decisions.record(
        projectId,
        "ACCEPT",
        "related-work:add",
        { title: input.title, sourceUrl: input.sourceUrl },
        transaction,
      );
      if (idempotencyKey) {
        await transaction.idempotencyRecord.create({
          data: {
            projectId,
            key: idempotencyKey,
            operation: "add-related-work",
            result: spec as unknown as Prisma.InputJsonValue,
          },
        });
      }
      return spec;
    });
  }

  /** Removes a related-work entry (matched by id, source_url, or paper_title). */
  async removeRelatedWork(projectId: string, workId: string): Promise<SpecIteration> {
    return this.prisma.$transaction(async (transaction) => {
      const project = await transaction.researchProject.findUnique({
        where: { id: projectId },
        include: { latestSpec: true },
      });
      if (!project?.latestSpec)
        throw new NotFoundException(
          `No latest spec exists for project ${projectId}`,
        );
      const current = project.latestSpec;
      const currentData = current.data as SpecData;
      const existing = this.asRelatedWorkArray(currentData.relatedWork);
      const remaining = existing.filter(
        (entry) => !this.isRelatedWork(entry, workId),
      );
      if (remaining.length === existing.length) {
        throw new NotFoundException(`Related work ${workId} was not found`);
      }
      const nextData = { ...currentData, relatedWork: remaining };
      const spec = await transaction.specIteration.create({
        data: {
          projectId,
          version: current.version + 1,
          data: nextData as Prisma.InputJsonValue,
        },
      });
      await transaction.researchProject.update({
        where: { id: projectId },
        data: { latestSpecId: spec.id },
      });
      await this.cloneVersionData(
        transaction,
        projectId,
        current.id,
        spec.id,
      );
      const affectedNodes =
        this.dependencyGraph.getAffectedNodes("related_work");
      for (const affectedNode of affectedNodes) {
        await transaction.specArtifact.upsert({
          where: {
            specIterationId_node: {
              specIterationId: spec.id,
              node: affectedNode,
            },
          },
          create: {
            projectId,
            specIterationId: spec.id,
            node: affectedNode,
            status: "STALE",
            data: {},
          },
          update: { status: "STALE" },
        });
      }
      await this.decisions.record(
        projectId,
        "ACCEPT",
        "related-work:remove",
        { workId },
        transaction,
      );
      return spec;
    });
  }

  /** Maps a dependency-graph node name to the spec `data` key it is stored under. */
  private dataKeyForNode(node: string): string {
    return node === "related_work" ? "relatedWork" : node;
  }

  /**
   * Copies cards, links, spec artifacts, and judge issues from one spec version
   * to another (immutable versioning). Artifacts and judge issues must be cloned
   * forward too, otherwise every version bump orphans the final-spec artifact
   * (PDF export 404s) and wipes STALE markers / judge issues.
   */
  async cloneVersionData(
    transaction: Prisma.TransactionClient,
    projectId: string,
    fromSpecId: string,
    toSpecId: string,
  ): Promise<void> {
    const cards = await transaction.specCard.findMany({
      where: { projectId, specIterationId: fromSpecId },
    });
    const cardMap = new Map<string, string>();
    for (const card of cards) {
      const clone = await transaction.specCard.create({
        data: {
          projectId,
          specIterationId: toSpecId,
          type: card.type,
          lineageId: card.lineageId,
          status: card.status,
          content: card.content,
          isSeed: card.isSeed,
          reason: card.reason,
          metadata: card.metadata as Prisma.InputJsonValue | undefined,
          createdAt: card.createdAt,
        },
      });
      cardMap.set(card.id, clone.id);
    }
    const links = await transaction.specCardLink.findMany({
      where: { projectId, specIterationId: fromSpecId },
    });
    for (const link of links) {
      const sourceId = cardMap.get(link.sourceCardId);
      const targetId = cardMap.get(link.targetCardId);
      if (!sourceId || !targetId) continue; // skip orphan links
      await transaction.specCardLink.create({
        data: {
          projectId,
          specIterationId: toSpecId,
          sourceCardId: sourceId,
          targetCardId: targetId,
          type: link.type,
        },
      });
    }
    // Clone spec artifacts forward so invalidation state and the final-spec
    // artifact survive version bumps.
    const artifacts = await transaction.specArtifact.findMany({
      where: { projectId, specIterationId: fromSpecId },
    });
    for (const artifact of artifacts) {
      await transaction.specArtifact.create({
        data: {
          projectId,
          specIterationId: toSpecId,
          node: artifact.node,
          status: artifact.status,
          data: artifact.data as Prisma.InputJsonValue,
        },
      });
    }
    // Clone judge issues forward so they survive version bumps (otherwise
    // GET /issues returns [] and the final spec's judges_summary is empty).
    const issues = await transaction.judgeIssue.findMany({
      where: { projectId, specIterationId: fromSpecId },
    });
    for (const issue of issues) {
      await transaction.judgeIssue.create({
        data: {
          projectId,
          specIterationId: toSpecId,
          judgeType: issue.judgeType,
          severity: issue.severity,
          title: issue.title,
          description: issue.description,
          suggestion: issue.suggestion,
          flaggedBy: issue.flaggedBy,
          choices: issue.choices as Prisma.InputJsonValue,
          status: issue.status,
          resolvedChoice: issue.resolvedChoice,
          customResolution: issue.customResolution,
        },
      });
    }
  }

  private asRelatedWorkArray(value: unknown): Record<string, unknown>[] {
    if (!Array.isArray(value)) return [];
    return value.filter(
      (item): item is Record<string, unknown> =>
        typeof item === "object" && item !== null,
    );
  }

  private toRelatedWorkItem(input: {
    title: string;
    sourceUrl?: string;
    year?: string;
    whatItDid?: string;
    feedbackType?: string;
    missingGap?: string;
    sourceType?: string;
  }): Record<string, unknown> {
    return {
      id: randomUUID(),
      paper_title: input.title,
      authors: "",
      year: input.year ? Number(input.year) || 0 : 0,
      what_they_did: input.whatItDid ?? "",
      feedback: input.feedbackType ?? "",
      missing_points: input.missingGap ?? "",
      source_url: input.sourceUrl ?? "",
      source_type: input.sourceType ?? "",
    };
  }

  private sameRelatedWork(
    left: Record<string, unknown>,
    right: Record<string, unknown>,
  ): boolean {
    const leftUrl = String(left.source_url ?? "").trim();
    const rightUrl = String(right.source_url ?? "").trim();
    if (leftUrl && rightUrl) return leftUrl === rightUrl;
    return (
      String(left.paper_title ?? "")
        .trim()
        .toLowerCase() ===
      String(right.paper_title ?? "")
        .trim()
        .toLowerCase()
    );
  }

  private isRelatedWork(entry: Record<string, unknown>, workId: string): boolean {
    const id = String(entry.id ?? "");
    if (id && id === workId) return true;
    const url = String(entry.source_url ?? "");
    if (url && url === workId) return true;
    return (
      String(entry.paper_title ?? "")
        .trim()
        .toLowerCase() === workId.trim().toLowerCase()
    );
  }

  async getInvalidations(projectId: string) {
    const project = await this.prisma.researchProject.findUnique({
      where: { id: projectId },
      include: { latestSpec: { include: { artifacts: true } } },
    });
    if (!project)
      throw new NotFoundException(`Project ${projectId} was not found`);
    if (!project.latestSpec)
      throw new NotFoundException(
        `No latest spec exists for project ${projectId}`,
      );
    const staleArtifacts = project.latestSpec.artifacts.filter(
      (a) => a.status === "STALE",
    );
    const staleNodes = staleArtifacts.map((a) => a.node);
    const allNodes = this.dependencyGraph.getAllNodes();
    const freshNodes = allNodes.filter((node) => !staleNodes.includes(node));
    return {
      specIterationId: project.latestSpec.id,
      specVersion: project.latestSpec.version,
      staleNodes,
      freshNodes,
    };
  }
}
