import { Inject, Injectable, NotFoundException } from "@nestjs/common";
import { DecisionService } from "./decision.service";
import { AI_GATEWAY, AiGateway } from "./integrations/ai-gateway.port";
import { PrismaService } from "./prisma.service";

export type ClarifyAnswerInput = {
  questionId: string;
  selectedIndex: number;
  customAnswer?: string;
};

@Injectable()
export class ClarifyService {
  constructor(
    private readonly prisma: PrismaService,
    @Inject(AI_GATEWAY) private readonly ai: AiGateway,
    private readonly decisions: DecisionService,
  ) {}

  /** Step 1a: system understanding of the idea. Calls ai_service, persists Clarification. */
  async understand(projectId: string, idea: string, feedback?: string) {
    await this.assertProject(projectId);
    const response = await this.ai.understandIdea(idea, feedback);
    const output = response.output;
    const clarifiedIdea = String(output.clarified_idea ?? "");
    const keyIssues = Array.isArray(output.key_issues)
      ? output.key_issues.map(String)
      : [];
    const confidence =
      typeof output.confidence === "number" ? output.confidence : null;
    await this.prisma.clarification.upsert({
      where: { projectId },
      create: {
        projectId,
        idea,
        clarifiedIdea,
        keyIssues,
        confidence,
        feedback,
      },
      update: { idea, clarifiedIdea, keyIssues, confidence, feedback },
    });
    return { clarifiedIdea, keyIssues, confidence };
  }

  /** Step 1b: confirmation questions derived from the confirmed understanding. */
  async questions(projectId: string) {
    const clarification = await this.prisma.clarification.findUnique({
      where: { projectId },
    });
    if (!clarification) {
      throw new NotFoundException(
        `No clarification exists for project ${projectId}`,
      );
    }
    // Regenerating questions replaces any previously unanswered ones (answered rows are kept).
    await this.prisma.confirmationQuestion.deleteMany({
      where: { projectId, answeredAt: null },
    });
    const response = await this.ai.generateQuestions(
      clarification.clarifiedIdea,
    );
    const rawQuestions = Array.isArray(response.output.questions)
      ? response.output.questions
      : [];
    const questions = [];
    for (const raw of rawQuestions) {
      const record = raw as Record<string, unknown>;
      const title = String(record.question ?? record.title ?? "");
      const example = record.example ? String(record.example) : null;
      const options = Array.isArray(record.options)
        ? record.options.map(String)
        : [];
      const created = await this.prisma.confirmationQuestion.create({
        data: { projectId, question: title, title, example, options },
      });
      questions.push({
        id: created.id,
        title: created.title ?? created.question,
        example: created.example,
        options: created.options,
      });
    }
    return { questions };
  }

  /** Step 1c: batch-save answers (selectedIndex + customAnswer). No AI call. */
  async answer(projectId: string, answers: ClarifyAnswerInput[]) {
    await this.assertProject(projectId);
    return this.prisma.$transaction(async (tx) => {
      for (const answer of answers) {
        const question = await tx.confirmationQuestion.findFirst({
          where: { id: answer.questionId, projectId },
        });
        if (!question) {
          throw new NotFoundException(
            `Confirmation question ${answer.questionId} was not found`,
          );
        }
        // Populate the `answer` column: custom text if provided, else the selected
        // option (downstream reads previously got null).
        const finalAnswer =
          answer.customAnswer ??
          (typeof answer.selectedIndex === "number"
            ? question.options[answer.selectedIndex] ?? null
            : null);
        await tx.confirmationQuestion.update({
          where: { id: answer.questionId },
          data: {
            selectedIndex: answer.selectedIndex,
            customAnswer: answer.customAnswer,
            answer: finalAnswer,
            answeredAt: new Date(),
          },
        });
      }
      await this.decisions.record(projectId, "ACCEPT", "clarify-answers", { answers }, tx);
      return { saved: true };
    });
  }

  private async assertProject(projectId: string): Promise<void> {
    const project = await this.prisma.researchProject.findUnique({
      where: { id: projectId },
      select: { id: true },
    });
    if (!project)
      throw new NotFoundException(`Project ${projectId} was not found`);
  }
}
