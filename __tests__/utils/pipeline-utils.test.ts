/**
 * Tests for lib/pipeline-utils.ts
 * Core Sankey chart data builder
 */

import {
  buildStatusPath,
  countTransitions,
  buildSankeyData,
} from '@/lib/pipeline-utils';
import {
  makeApplication,
  makeApplicationHistory,
  SAMPLE_STAGES,
} from '../fixtures/applications';

describe('buildStatusPath', () => {
  describe('with no history', () => {
    it('returns ["Applied"] for an application with status Applied', () => {
      const app = makeApplication({ id: 'abc', status: 'Applied' });
      const result = buildStatusPath(app, [], SAMPLE_STAGES);
      expect(result[0]).toBe('Applied');
    });

    it('builds a path up to Interview Scheduled when no history', () => {
      const app = makeApplication({ id: 'abc', status: 'Interview Scheduled' });
      const result = buildStatusPath(app, [], SAMPLE_STAGES);
      expect(result).toContain('Applied');
      expect(result).toContain('Interview Scheduled');
    });

    it('builds a path through Interviewed when no history', () => {
      const app = makeApplication({ id: 'abc', status: 'Interviewed' });
      const result = buildStatusPath(app, [], SAMPLE_STAGES);
      expect(result).toContain('Applied');
      expect(result).toContain('Interviewed');
    });

    it('builds a path through Offer when no history', () => {
      const app = makeApplication({ id: 'abc', status: 'Offer' });
      const result = buildStatusPath(app, [], SAMPLE_STAGES);
      expect(result).toContain('Applied');
      expect(result).toContain('Offer');
    });

    it('builds a path through Hired when no history', () => {
      const app = makeApplication({ id: 'abc', status: 'Hired' });
      const result = buildStatusPath(app, [], SAMPLE_STAGES);
      expect(result).toContain('Applied');
      expect(result).toContain('Hired');
    });

    it('includes Rejected in path for Rejected app with no history', () => {
      const app = makeApplication({ id: 'abc', status: 'Rejected' });
      const result = buildStatusPath(app, [], SAMPLE_STAGES);
      expect(result).toContain('Applied');
      expect(result).toContain('Rejected');
    });

    it('is deterministic — same id always produces same path', () => {
      const app = makeApplication({ id: 'test-id-123', status: 'Rejected' });
      const result1 = buildStatusPath(app, [], SAMPLE_STAGES);
      const result2 = buildStatusPath(app, [], SAMPLE_STAGES);
      expect(result1).toEqual(result2);
    });

    it('does not produce duplicate statuses in path', () => {
      const app = makeApplication({ id: 'abc', status: 'Interviewed' });
      const result = buildStatusPath(app, [], SAMPLE_STAGES);
      const unique = [...new Set(result)];
      expect(result).toEqual(unique);
    });

    it('handles null/undefined history gracefully', () => {
      const app = makeApplication({ id: 'abc', status: 'Applied' });
      expect(() => buildStatusPath(app, null as any, SAMPLE_STAGES)).not.toThrow();
      expect(() => buildStatusPath(app, undefined as any, SAMPLE_STAGES)).not.toThrow();
    });
  });

  describe('with history', () => {
    it('builds path using history entries sorted by changed_at', () => {
      const app = makeApplication({ id: 'app-001', status: 'Interviewed' });
      const history = [
        makeApplicationHistory({
          application_id: 'app-001',
          old_status: null,
          new_status: 'Interview Scheduled',
          changed_at: '2024-01-16T00:00:00Z',
        }),
        makeApplicationHistory({
          id: 'hist-002',
          application_id: 'app-001',
          old_status: 'Interview Scheduled',
          new_status: 'Interviewed',
          changed_at: '2024-01-18T00:00:00Z',
        }),
      ];

      const result = buildStatusPath(app, history, SAMPLE_STAGES);
      expect(result[0]).toBe('Applied');
      expect(result).toContain('Interview Scheduled');
      expect(result).toContain('Interviewed');
    });

    it('includes Rejected at the end for rejected transitions', () => {
      const app = makeApplication({ id: 'app-001', status: 'Rejected' });
      const history = [
        makeApplicationHistory({
          application_id: 'app-001',
          old_status: 'Interview Scheduled',
          new_status: 'Rejected',
          changed_at: '2024-01-20T00:00:00Z',
        }),
      ];

      const result = buildStatusPath(app, history, SAMPLE_STAGES);
      expect(result[result.length - 1]).toBe('Rejected');
    });

    it('ignores history entries for other application ids', () => {
      const app = makeApplication({ id: 'app-001', status: 'Applied' });
      const history = [
        makeApplicationHistory({
          application_id: 'different-app-id',
          old_status: null,
          new_status: 'Hired',
          changed_at: '2024-01-16T00:00:00Z',
        }),
      ];

      const result = buildStatusPath(app, history, SAMPLE_STAGES);
      // Should not contain 'Hired' since that history entry is for a different app
      expect(result).not.toContain('Hired');
    });
  });
});

describe('countTransitions', () => {
  it('returns empty map for empty paths array', () => {
    const result = countTransitions([]);
    expect(result.size).toBe(0);
  });

  it('returns empty map for single-node path (no transitions)', () => {
    const result = countTransitions([['Applied']]);
    expect(result.size).toBe(0);
  });

  it('counts a single transition correctly', () => {
    const result = countTransitions([['Applied', 'Interview Scheduled']]);
    expect(result.get('Applied→Interview Scheduled')).toBe(1);
  });

  it('counts multiple identical transitions', () => {
    const paths = [
      ['Applied', 'Interview Scheduled'],
      ['Applied', 'Interview Scheduled'],
      ['Applied', 'Rejected'],
    ];
    const result = countTransitions(paths);
    expect(result.get('Applied→Interview Scheduled')).toBe(2);
    expect(result.get('Applied→Rejected')).toBe(1);
  });

  it('counts multi-step path transitions correctly', () => {
    const paths = [
      ['Applied', 'Interview Scheduled', 'Interviewed', 'Offer', 'Hired'],
    ];
    const result = countTransitions(paths);
    expect(result.get('Applied→Interview Scheduled')).toBe(1);
    expect(result.get('Interview Scheduled→Interviewed')).toBe(1);
    expect(result.get('Interviewed→Offer')).toBe(1);
    expect(result.get('Offer→Hired')).toBe(1);
  });

  it('aggregates transitions from multiple paths correctly', () => {
    const paths = [
      ['Applied', 'Rejected'],
      ['Applied', 'Rejected'],
      ['Applied', 'Interview Scheduled', 'Rejected'],
    ];
    const result = countTransitions(paths);
    expect(result.get('Applied→Rejected')).toBe(2);
    expect(result.get('Applied→Interview Scheduled')).toBe(1);
    expect(result.get('Interview Scheduled→Rejected')).toBe(1);
  });
});

describe('buildSankeyData', () => {
  const nodeLabels = ['Applied', 'Interview Scheduled', 'Interviewed', 'Offer', 'Hired', 'Rejected'];
  const nodeColors = ['blue', 'yellow', 'orange', 'green', 'darkgreen', 'red'];

  it('returns empty arrays for empty transition map', () => {
    const transitions = new Map<string, number>();
    const result = buildSankeyData(transitions, nodeLabels, nodeColors);
    expect(result.sources).toEqual([]);
    expect(result.targets).toEqual([]);
    expect(result.values).toEqual([]);
    expect(result.linkColors).toEqual([]);
  });

  it('maps node labels to correct indices', () => {
    const transitions = new Map([['Applied→Interview Scheduled', 3]]);
    const result = buildSankeyData(transitions, nodeLabels, nodeColors);
    expect(result.sources[0]).toBe(0); // 'Applied' is index 0
    expect(result.targets[0]).toBe(1); // 'Interview Scheduled' is index 1
    expect(result.values[0]).toBe(3);
  });

  it('colors Rejected links red', () => {
    const transitions = new Map([['Applied→Rejected', 2]]);
    const result = buildSankeyData(transitions, nodeLabels, nodeColors);
    expect(result.linkColors[0]).toContain('239, 68, 68');
  });

  it('colors Hired links green', () => {
    const transitions = new Map([['Offer→Hired', 1]]);
    const result = buildSankeyData(transitions, nodeLabels, nodeColors);
    expect(result.linkColors[0]).toContain('34, 197, 94');
  });

  it('colors normal transitions blue', () => {
    const transitions = new Map([['Applied→Interview Scheduled', 1]]);
    const result = buildSankeyData(transitions, nodeLabels, nodeColors);
    expect(result.linkColors[0]).toContain('59, 130, 246');
  });

  it('skips transitions with unknown node labels', () => {
    const transitions = new Map([['Unknown→Nowhere', 5]]);
    const result = buildSankeyData(transitions, nodeLabels, nodeColors);
    expect(result.sources).toHaveLength(0);
  });

  it('handles all possible status transitions without throwing', () => {
    const allTransitions = new Map([
      ['Applied→Interview Scheduled', 2],
      ['Applied→Rejected', 1],
      ['Interview Scheduled→Interviewed', 2],
      ['Interviewed→Offer', 1],
      ['Offer→Hired', 1],
      ['Offer→Rejected', 1],
    ]);
    expect(() => buildSankeyData(allTransitions, nodeLabels, nodeColors)).not.toThrow();
  });
});
