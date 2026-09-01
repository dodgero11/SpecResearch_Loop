import { DependencyGraphService, WORKFLOW_NODES } from '../src/dependency-graph.service';

describe('DependencyGraphService', () => {
  const service = new DependencyGraphService();

  describe('getAllNodes', () => {
    it('returns all 7 workflow nodes', () => {
      expect(service.getAllNodes()).toEqual(WORKFLOW_NODES);
    });
  });

  describe('getDependents', () => {
    it('returns direct dependents for each node', () => {
      expect(service.getDependents('problem')).toEqual(['gap', 'judge']);
      expect(service.getDependents('related_work')).toEqual(['gap']);
      expect(service.getDependents('gap')).toEqual(['contribution', 'judge']);
      expect(service.getDependents('contribution')).toEqual(['claim', 'judge']);
      expect(service.getDependents('claim')).toEqual(['experiment', 'judge']);
      expect(service.getDependents('experiment')).toEqual(['judge']);
      expect(service.getDependents('judge')).toEqual([]);
    });
  });

  describe('getAffectedNodes', () => {
    it('changing problem invalidates the node and all downstream nodes', () => {
      const affected = service.getAffectedNodes('problem');
      expect(affected).toEqual(expect.arrayContaining(['problem', 'gap', 'contribution', 'claim', 'experiment', 'judge']));
      expect(affected).not.toContain('related_work');
      expect(affected).toHaveLength(6);
    });

    it('changing related_work invalidates the node, gap, and all downstream', () => {
      const affected = service.getAffectedNodes('related_work');
      expect(affected).toEqual(expect.arrayContaining(['related_work', 'gap', 'contribution', 'claim', 'experiment', 'judge']));
      expect(affected).not.toContain('problem');
      expect(affected).toHaveLength(6);
    });

    it('changing gap invalidates the node, contribution, claim, experiment, and judge', () => {
      const affected = service.getAffectedNodes('gap');
      expect(affected).toEqual(expect.arrayContaining(['gap', 'contribution', 'claim', 'experiment', 'judge']));
      expect(affected).not.toContain('problem');
      expect(affected).not.toContain('related_work');
      expect(affected).toHaveLength(5);
    });

    it('changing contribution invalidates the node, claim, experiment, and judge', () => {
      const affected = service.getAffectedNodes('contribution');
      expect(affected).toEqual(expect.arrayContaining(['contribution', 'claim', 'experiment', 'judge']));
      expect(affected).toHaveLength(4);
    });

    it('changing claim invalidates the node, experiment, and judge', () => {
      const affected = service.getAffectedNodes('claim');
      expect(affected).toEqual(expect.arrayContaining(['claim', 'experiment', 'judge']));
      expect(affected).toHaveLength(3);
    });

    it('changing experiment invalidates the node and judge', () => {
      const affected = service.getAffectedNodes('experiment');
      expect(affected).toEqual(['experiment', 'judge']);
    });

    it('changing judge invalidates only the judge node', () => {
      const affected = service.getAffectedNodes('judge');
      expect(affected).toEqual(['judge']);
    });
  });

  describe('getDependencyOrder', () => {
    it('returns a valid topological order', () => {
      const order = service.getDependencyOrder();
      expect(order).toHaveLength(WORKFLOW_NODES.length);
      const indexMap = new Map(order.map((node, i) => [node, i]));
      for (const node of WORKFLOW_NODES) {
        for (const dependent of service.getDependents(node)) {
          expect(indexMap.get(node)!).toBeLessThan(indexMap.get(dependent)!);
        }
      }
    });

    it('places judge last', () => {
      const order = service.getDependencyOrder();
      expect(order[order.length - 1]).toBe('judge');
    });
  });

  describe('getNodeForCardType', () => {
    it('maps card types to workflow nodes', () => {
      expect(service.getNodeForCardType('PROBLEM')).toBe('problem');
      expect(service.getNodeForCardType('RESEARCH_QUESTION')).toBe('problem');
      expect(service.getNodeForCardType('GAP_CANDIDATE')).toBe('gap');
      expect(service.getNodeForCardType('CONTRIBUTION')).toBe('contribution');
      expect(service.getNodeForCardType('CLAIM')).toBe('claim');
      expect(service.getNodeForCardType('EVIDENCE')).toBe('claim');
      expect(service.getNodeForCardType('CONSTRAINT')).toBe('experiment');
      expect(service.getNodeForCardType('OPEN_QUESTION')).toBe('gap');
    });
  });

  describe('isValidNode', () => {
    it('accepts valid workflow nodes', () => {
      for (const node of WORKFLOW_NODES) {
        expect(service.isValidNode(node)).toBe(true);
      }
    });

    it('rejects invalid node names', () => {
      expect(service.isValidNode('invalid')).toBe(false);
      expect(service.isValidNode('')).toBe(false);
      expect(service.isValidNode('claims')).toBe(false);
    });
  });
});
