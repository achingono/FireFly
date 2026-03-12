import { request } from "./base";

export interface MasteryConcept {
  conceptId: string;
  conceptName: string;
  sortOrder: number;
  prerequisites: string[];
  score: number;
  attempts: number;
  lastAttemptAt: string | null;
  mastered: boolean;
}

export interface MasteryMapResponse {
  userId: string;
  masteryThreshold: number;
  concepts: MasteryConcept[];
}

export interface MasteryUpdateResponse {
  conceptId: string;
  previousScore: number;
  newScore: number;
  delta: number;
  attempts: number;
  mastered: boolean;
  justMastered: boolean;
  newlyUnlocked: string[];
  masteryThreshold: number;
}

export interface MasteryConceptDetailHistoryItem {
  date: string;
  correct: boolean;
  scoreBefore: number;
  scoreAfter: number;
  delta: number;
  exerciseId: string | null;
}

export interface MasteryConceptDetailResponse {
  conceptId: string;
  conceptName: string;
  score: number;
  attempts: number;
  lastAttemptAt: string | null;
  mastered: boolean;
  history: MasteryConceptDetailHistoryItem[];
}

export const progress = {
  masteryMap: async (userId: string): Promise<MasteryMapResponse | null> => {
    const envelope = await request<MasteryMapResponse>(`/progress/${userId}`);
    return envelope.data ?? null;
  },

  submit: async (userId: string, data: {
    conceptId: string;
    correct: boolean;
    exerciseId?: string;
  }): Promise<MasteryUpdateResponse | null> => {
    const envelope = await request<MasteryUpdateResponse>(`/progress/${userId}/update`, {
      method: "POST",
      body: JSON.stringify(data),
    });
    return envelope.data ?? null;
  },

  concept: async (userId: string, conceptId: string): Promise<MasteryConceptDetailResponse | null> => {
    const envelope = await request<MasteryConceptDetailResponse>(`/progress/${userId}/concept/${conceptId}`);
    return envelope.data ?? null;
  },
};
