import { Injectable } from '@angular/core';
import { EnvironmentInjector, runInInjectionContext } from '@angular/core';
import {
  addDoc,
  collection,
  collectionData,
  Firestore,
  getDocs,
  doc,
  limit,
  orderBy,
  query,
  setDoc,
  serverTimestamp,
  updateDoc,
  deleteDoc,
  where
} from '@angular/fire/firestore';
import { Observable, catchError, map, of, switchMap } from 'rxjs';
import { QuizQuestion, QuizResult } from '../models/quiz.models';

@Injectable({ providedIn: 'root' })
export class QuizDataService {
  constructor(
    private readonly firestore: Firestore,
    private readonly injector: EnvironmentInjector
  ) {}

  private inCtx<T>(fn: () => T): T {
    return runInInjectionContext(this.injector, fn);
  }

  getQuestions$(quizDate?: string): Observable<QuizQuestion[]> {
    const ref = collection(this.firestore, 'questions');

    const allQ = query(ref, orderBy('order', 'asc'), limit(10));

    if (!quizDate) {
      return this.inCtx(() => collectionData(allQ, { idField: 'id' })).pipe(
        map((items): QuizQuestion[] => items as QuizQuestion[]),
        map((items: QuizQuestion[]) => (items.length ? items : DEFAULT_QUESTIONS)),
        catchError(() => of(DEFAULT_QUESTIONS))
      );
    }

    // On tente d'abord les questions du jour, sinon fallback à "toutes", sinon DEFAULT.
    const dayQ = query(ref, where('quizDate', '==', quizDate), orderBy('order', 'asc'), limit(10));
    const all$ = () =>
      this.inCtx(() => collectionData(allQ, { idField: 'id' })).pipe(
        map((items): QuizQuestion[] => items as QuizQuestion[]),
        map((items: QuizQuestion[]) => (items.length ? items : DEFAULT_QUESTIONS)),
        catchError(() => of(DEFAULT_QUESTIONS))
      );

    return this.inCtx(() => collectionData(dayQ, { idField: 'id' })).pipe(
      map((items): QuizQuestion[] => items as QuizQuestion[]),
      switchMap((dayItems: QuizQuestion[]) => {
        if (dayItems.length) return of(dayItems);
        return all$();
      }),
      catchError(() => all$())
    );
  }

  getResults$(): Observable<QuizResult[]> {
    const ref = collection(this.firestore, 'results');
    const q = query(ref, orderBy('createdAt', 'desc'));
    return collectionData(q, { idField: 'id' }).pipe(map((items): QuizResult[] => items as QuizResult[]));
  }

  addQuestion(question: Omit<QuizQuestion, 'createdAt'>): Promise<void> {
    const ref = collection(this.firestore, 'questions');
    return addDoc(ref, { ...question, createdAt: serverTimestamp() }).then(() => undefined);
  }

  updateQuestion(id: string, patch: Partial<Omit<QuizQuestion, 'id'>>): Promise<void> {
    const ref = doc(this.firestore, 'questions', id);
    return updateDoc(ref, { ...patch }).then(() => undefined);
  }

  deleteQuestion(id: string): Promise<void> {
    const ref = doc(this.firestore, 'questions', id);
    return deleteDoc(ref).then(() => undefined);
  }

  saveResult(result: Omit<QuizResult, 'createdAt'>): Promise<void> {
    const ref = collection(this.firestore, 'results');
    return addDoc(ref, { ...result, createdAt: serverTimestamp() }).then(() => undefined);
  }

  async displayNameExistsForDate(quizDate: string, displayName: string): Promise<boolean> {
    const ref = collection(this.firestore, 'results');
    const q = query(
      ref,
      where('quizDate', '==', quizDate),
      where('displayName', '==', displayName),
      limit(1)
    );
    const snap = await this.inCtx(() => getDocs(q));
    return !snap.empty;
  }

  /**
   * Réserve un nom pour une date sans aucune lecture (compatible rules publiques).
   * Implémentation: setDoc sur un doc-id déterministe. Si le doc existe déjà,
   * setDoc devient un "update" -> doit être refusé par les rules (allow update: false).
   */
  async reserveDisplayName(quizDate: string, displayName: string): Promise<void> {
    const key = normalizeDisplayName(displayName);
    const id = `${quizDate}__${key}`;
    const ref = doc(this.firestore, 'name_locks', id);
    await this.inCtx(() =>
      setDoc(ref, {
        quizDate,
        displayName: displayName.trim(),
        createdAt: serverTimestamp()
      })
    );
  }
}

function normalizeDisplayName(name: string) {
  return name
    .trim()
    .toLowerCase()
    .replace(/\s+/g, ' ')
    .replace(/[^a-z0-9\u00C0-\u024F ]/g, '') // garde lettres latines (accents) + chiffres + espaces
    .replace(/\s+/g, '-')
    .slice(0, 48);
}

const DEFAULT_QUESTIONS: QuizQuestion[] = [
  {
    part: 'carlo',
    partLabel: 'Partie 1 — St Carlo Acutis',
    partIcon: 'computer',
    order: 1,
    question: 'En quelle année Carlo Acutis a-t-il été béatifié ?',
    options: ['2006', '2018', '2020', '2024'],
    correctIndex: 2,
    explanation: 'Le 10 octobre 2020 à Assise.',
  },
  {
    part: 'carlo',
    partLabel: 'Partie 1 — St Carlo Acutis',
    partIcon: 'computer',
    order: 2,
    question: 'Quel était le grand projet numérique de Carlo ?',
    options: [
      'Une chaîne YouTube sur les jeux vidéo',
      'Une exposition en ligne sur les miracles eucharistiques',
      'Une appli pour prier le chapelet',
      'Un blog de recettes italiennes',
    ],
    correctIndex: 1,
    explanation: 'Une exposition en ligne sur les miracles eucharistiques (traduite en 17 langues).',
  },
  {
    part: 'carlo',
    partLabel: 'Partie 1 — St Carlo Acutis',
    partIcon: 'computer',
    order: 3,
    question: 'Quel vêtement porte le corps de Carlo exposé à Assise ?',
    options: ['Une soutane', 'Un costume-cravate', 'Un jean, un sweat et des baskets', "L'habit franciscain"],
    correctIndex: 2,
    explanation: 'Un jean, un sweat et des baskets.',
  },
  {
    part: 'carlo',
    partLabel: 'Partie 1 — St Carlo Acutis',
    partIcon: 'computer',
    order: 4,
    question: "Complète la phrase : « L'Eucharistie, c'est mon… »",
    options: ['…trésor secret', '…autoroute vers le Ciel', '…pain quotidien', '…meilleur ami'],
    correctIndex: 1,
    explanation: '« …autoroute vers le Ciel ».',
  },
  {
    part: 'carlo',
    partLabel: 'Partie 1 — St Carlo Acutis',
    partIcon: 'computer',
    order: 5,
    question: 'De quoi Carlo Acutis est-il mort à 15 ans ?',
    options: ['Un accident de vélo', 'Une leucémie foudroyante', 'Le Covid-19', 'Une crise cardiaque'],
    correctIndex: 1,
    explanation: 'Une leucémie foudroyante (type M3).',
  },
  {
    part: 'evangile',
    partLabel: 'Partie 2 — Évangile du 20 avril 2026 (Jn 6,22-29)',
    partIcon: 'menu_book',
    order: 6,
    question: "Pourquoi la foule cherche-t-elle Jésus au début de l'Évangile ?",
    options: [
      "Pour l'écouter enseigner",
      "Parce qu'elle a vu un signe du Ciel",
      "Parce qu'elle a mangé du pain et a été rassasiée",
      'Pour le faire roi',
    ],
    correctIndex: 2,
    explanation: 'Jn 6,26.',
  },
  {
    part: 'evangile',
    partLabel: 'Partie 2 — Évangile du 20 avril 2026 (Jn 6,22-29)',
    partIcon: 'menu_book',
    order: 7,
    question: 'Jésus dit à la foule de travailler pour une nourriture qui…',
    options: ['…ne coûte pas cher', '…se garde dans des jarres', '…demeure jusque dans la vie éternelle', '…nourrit toute la famille'],
    correctIndex: 2,
    explanation: 'Jn 6,27.',
  },
  {
    part: 'evangile',
    partLabel: 'Partie 2 — Évangile du 20 avril 2026 (Jn 6,22-29)',
    partIcon: 'menu_book',
    order: 8,
    question: "Quelle est l'œuvre de Dieu selon Jésus ?",
    options: [
      'Donner à manger aux pauvres',
      'Prier sans cesse',
      "Croire en celui qu'il a envoyé",
      'Observer la Loi de Moïse',
    ],
    correctIndex: 2,
    explanation: 'Jn 6,29.',
  },
  {
    part: 'evangile',
    partLabel: "Lecture (Ac 6,1-7)",
    partIcon: 'history_edu',
    order: 9,
    question: 'Pourquoi les Apôtres instituent-ils les diacres ?',
    options: [
      'Pour construire de nouvelles églises',
      'Pour rester assidus à la prière et au service de la Parole',
      "Pour collecter l'argent",
      'Pour guérir les malades',
    ],
    correctIndex: 1,
    explanation: 'Ac 6,4.',
  },
  {
    part: 'synthese',
    partLabel: 'Synthèse',
    partIcon: 'link',
    order: 10,
    question: "Quel est le point commun entre Carlo Acutis et l'Évangile du jour ?",
    options: [
      'Les deux parlent de pain',
      'Les deux invitent à chercher Jésus pour Lui-même, dans la foi et l’Eucharistie',
      'Les deux se passent en Italie',
      "Les deux parlent d'internet",
    ],
    correctIndex: 1,
    explanation: 'Chercher Jésus pour Lui-même, dans la foi et l’Eucharistie.',
  },
];

