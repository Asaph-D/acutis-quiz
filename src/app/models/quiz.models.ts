export type QuizPart = 'carlo' | 'evangile' | 'synthese';

export interface QuizQuestion {
  id?: string;
  quizDate?: string; // YYYY-MM-DD (quiz du jour)
  part: QuizPart;
  partLabel: string;
  partIcon: string; // material icon name
  order: number;
  question: string;
  options: [string, string, string, string];
  correctIndex: 0 | 1 | 2 | 3;
  explanation: string;
  createdAt?: unknown;
}

export interface QuizResult {
  id?: string;
  quizDate?: string; // YYYY-MM-DD
  displayName: string;
  total: number;
  score: number;
  answers: Array<0 | 1 | 2 | 3 | null>;
  createdAt?: unknown;
}

