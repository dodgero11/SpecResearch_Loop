import { Injectable } from '@nestjs/common';
import { Prisma } from '@prisma/client';
import { ProjectService, SpecData } from './project.service';

export type ContextTask = 'gap-judge' | 'contribution-judge' | 'experiment-judge' | 'evidence-judge' | 'conference-readiness-judge';
export type BuiltContext = { specVersion: number; inputContext: Prisma.InputJsonObject };

@Injectable()
export class ContextBuilderService {
  constructor(private readonly projects: ProjectService) {}

  async build(task: ContextTask, projectId: string): Promise<BuiltContext> {
    const spec = await this.projects.latestSpec(projectId);
    const data = spec.data as SpecData;
    const fieldsByTask: Record<ContextTask, string[]> = {
      'gap-judge': ['problem', 'gap', 'relatedWork'],
      'contribution-judge': ['problem', 'gap', 'contribution', 'relatedWork'],
      'experiment-judge': ['claims', 'baselines', 'experiment'],
      'evidence-judge': ['claims', 'evidence', 'relatedWork'],
      'conference-readiness-judge': ['problem', 'gap', 'contribution', 'claims', 'evidence', 'experiment', 'relatedWork'],
    };
      const inputContext = fieldsByTask[task].reduce<Record<string, Prisma.InputJsonValue>>((context, field) => {
      if (data[field] !== undefined) context[field] = data[field] as Prisma.InputJsonValue;
      return context;
    }, {});
      return { specVersion: spec.version, inputContext: inputContext as Prisma.InputJsonObject };
  }
}
