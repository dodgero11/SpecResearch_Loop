import { Body, Controller, Param, Post, Put } from '@nestjs/common';
import { ClaimEvidenceDto, ConfirmPlanDto, CreateContributionDto, FeasibilityDto, UpdateContributionDto } from './dto/experiment.dto';
import { ExperimentService } from './experiment.service';

@Controller('projects/:projectId')
export class ExperimentController {
  constructor(private readonly experiments: ExperimentService) {}

  @Post('spec-experiment')
  generatePlan(@Param('projectId') projectId: string) {
    return this.experiments.generatePlan(projectId);
  }

  @Post('contributions')
  addContribution(@Param('projectId') projectId: string, @Body() body: CreateContributionDto) {
    return this.experiments.addContribution(projectId, body.label);
  }

  @Put('contributions/:id')
  updateContribution(@Param('projectId') projectId: string, @Param('id') id: string, @Body() body: UpdateContributionDto) {
    return this.experiments.updateContribution(projectId, id, body.label);
  }

  @Put('contributions/:id/claim-evidence')
  saveClaimEvidence(@Param('projectId') projectId: string, @Param('id') id: string, @Body() body: ClaimEvidenceDto) {
    return this.experiments.saveClaimEvidence(projectId, id, body);
  }

  @Post('feasibility')
  feasibility(@Param('projectId') projectId: string, @Body() body: FeasibilityDto) {
    return this.experiments.feasibility(projectId, body.selectedContributionIds);
  }

  @Post('spec-experiment/confirm')
  confirm(@Param('projectId') projectId: string, @Body() body: ConfirmPlanDto) {
    return this.experiments.confirm(projectId, body.selectedContributionIds);
  }
}