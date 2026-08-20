import { Injectable } from '@nestjs/common';
import { Prisma } from '@prisma/client';
import { ProjectService, SpecData } from './project.service';

export type ContextTask = 'gap-judge' | 'experiment-judge' | 'claim-verifier';
export type BuiltContext = { specVersion: number; inputContext: Prisma.InputJsonObject };

@Injectable()
export class ContextBuilderService {
  constructor(private readonly projects: ProjectService) {}

  async build(task: ContextTask, projectId: string): Promise<BuiltContext> {
    const spec = await this.projects.latestSpec(projectId);
    const data = spec.data as SpecData;
    const fieldsByTask: Record<ContextTask, string[]> = {
      'gap-judge': ['problem', 'gap', 'relatedWork'],
      'experiment-judge': ['claims', 'baselines', 'experiment'],
      'claim-verifier': ['claim', 'evidence'],
    };
      const inputContext = fieldsByTask[task].reduce<Record<string, Prisma.InputJsonValue>>((context, field) => {
      if (data[field] !== undefined) context[field] = data[field] as Prisma.InputJsonValue;
      return context;
    }, {});
      return { specVersion: spec.version, inputContext: inputContext as Prisma.InputJsonObject };
  }
}
