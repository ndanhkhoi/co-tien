export type Personality = 'balanced' | 'aggressive' | 'defensive' | 'trickster';

export interface AiProfile {
  /** 1 Dễ · 2 Vừa · 3 Khó · 4 Tông Sư */
  level: 1 | 2 | 3 | 4;
  personality: Personality;
}
