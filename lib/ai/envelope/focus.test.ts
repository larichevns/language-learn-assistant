import { describe, expect, it } from 'vitest';
import { formatFocus } from './layers';

describe('formatFocus (Layer 03.5)', () => {
  it('renders due cards, weak topics (with bucket) and recent errors as <data>', () => {
    const out = formatFocus({
      dueCards: [{ lemma: 'das Haus', translationRu: 'дом' }],
      lapsedCards: [{ lemma: 'gehen' }],
      weakTopics: [{ title: 'Perfekt mit sein', decayed: 0.1 }],
      recentErrors: [{ label: 'CASE: mit der Hund (упражнение)' }],
    });
    expect(out).toContain('Focus');
    expect(out).toContain('due_card');
    expect(out).toContain('das Haus');
    expect(out).toContain('weak_topic');
    expect(out).toContain('Perfekt mit sein');
    expect(out).toContain('слабое'); // decayed 0.1 → «слабое»
    expect(out).toContain('recent_error');
  });

  it('is empty when there is nothing to focus on (no empty heading)', () => {
    expect(formatFocus({ dueCards: [], lapsedCards: [], weakTopics: [], recentErrors: [] })).toBe('');
  });
});
