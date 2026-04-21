export type QuizPart = 'carlo' | 'evangile' | 'synthese';

export interface Quiz {
  id?: string;
  date: string; // YYYY-MM-DD
  title: string;
  isActive: boolean;
  locked?: boolean;
  createdAt?: unknown;
}

export interface QuizQuestion {
  id?: string;
  part: QuizPart;
  partLabel: string;
  partIcon: string; // material icon name
  order: number;
  question: string;
  options: [string, string, string, string];
  correctIndex: 0 | 1 | 2 | 3;
  explanation: string;
  createdAt?: unknown;

  // UI/back-compat: utile pour l’admin/filtrage, dérivé du doc parent `quizzes/{date}`
  quizDate?: string;
}

export interface QuizResult {
  id?: string;
  displayName: string;
  total: number;
  score: number;
  answers: Array<0 | 1 | 2 | 3 | null>;
  createdAt?: unknown;

  // UI/back-compat: dérivé du doc parent `quizzes/{date}`
  quizDate?: string;
}

