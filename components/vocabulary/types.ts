/** A vocabulary row as returned by the list endpoint (`GET /api/vocabulary`). */
export interface VocabRow {
  id: string;
  lemma: string;
  pos: string;
  translationRu: string;
  gender?: string | null;
  pluralForm?: string | null;
  cefrLevel?: string | null;
  groupId?: string | null;
  srsCards?: Array<{ state: string; dueAt: string; direction?: string }>;
}

export interface VocabListResponse {
  items: VocabRow[];
  total: number;
}
