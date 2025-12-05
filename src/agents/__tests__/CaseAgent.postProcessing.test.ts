import { CaseAgent } from '../CaseAgent';
import { createTestCaseAgent } from './setup';

describe('CaseAgent - Post-Processing', () => {
  let agent: CaseAgent;

  beforeEach(() => {
    agent = createTestCaseAgent();
  });

  describe('postProcessResponse', () => {
    it('should remove bullet points from response', () => {
      const postProcess = (agent as any).postProcessResponse.bind(agent);

      const input = `Here are the steps:
* Step 1: First thing
* Step 2: Second thing
- Another item
1. Numbered item`;

      const output = postProcess(input, 'general', '', '', false, false);

      expect(output).not.toContain('*');
      expect(output).not.toContain('- ');
      expect(output).not.toMatch(/^\d+\./m);
    });

    it('should enforce help-seeking rules (max 3 sentences)', () => {
      const postProcess = (agent as any).postProcessResponse.bind(agent);

      const input = `Sentence one. Sentence two. Sentence three. Sentence four. Sentence five.`;
      const kbTitles = 'Help-Seeking Intent';

      const output = postProcess(input, 'help', '', kbTitles, false, false);

      // Count sentences (rough check)
      const sentences = output.split(/[.!?]+/).filter((s: string) => s.trim());
      expect(sentences.length).toBeLessThanOrEqual(4); // 3 + potential empty
    });

    it('should NOT add Totitos question if no banking alias', () => {
      const postProcess = (agent as any).postProcessResponse.bind(agent);

      const input = 'Gracias por donar.';

      const output = postProcess(input, 'donate', '', '', true, false);

      expect(output).not.toContain('totitos');
      expect(output).not.toContain('Totitos');
    });

    it('should add Totitos question if banking alias shown', () => {
      const postProcess = (agent as any).postProcessResponse.bind(agent);

      const input = 'Gracias por donar. El alias es guardian.alias.';

      const output = postProcess(input, 'donate', '', '', true, true);

      expect(output.toLowerCase()).toContain('totitos');
    });

    it('should NOT mention alias in donation intent before amount', () => {
      const postProcess = (agent as any).postProcessResponse.bind(agent);

      const input = 'Puedes donar usando el alias guardian.alias. El monto mínimo es $500.';
      const kbTitles = 'Donation Intent';

      const output = postProcess(input, 'donate', '', kbTitles, false, false);

      // Should remove alias mentions when amount not selected
      expect(output.toLowerCase()).not.toContain('alias');
    });
  });
});

