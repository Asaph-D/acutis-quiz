import { Injectable } from '@angular/core';
import {
  Firestore,
  addDoc,
  collection,
  collectionData,
  orderBy,
  query,
  serverTimestamp
} from '@angular/fire/firestore';
import { Observable, map } from 'rxjs';
import { QuizQuestion, QuizResult } from '../models/quiz.models';

@Injectable({ providedIn: 'root' })
export class QuizDataService {
  constructor(private readonly firestore: Firestore) {}

  getQuestions$(): Observable<QuizQuestion[]> {
    const ref = collection(this.firestore, 'questions');
    const q = query(ref, orderBy('order', 'asc'));
    return collectionData(q, { idField: 'id' }).pipe(
      map((items) => items as QuizQuestion[]),
      map((items) => (items.length ? items : DEFAULT_QUESTIONS))
    );
  }

  addQuestion(question: Omit<QuizQuestion, 'createdAt'>): Promise<void> {
    const ref = collection(this.firestore, 'questions');
    return addDoc(ref, { ...question, createdAt: serverTimestamp() }).then(() => undefined);
  }

  saveResult(result: Omit<QuizResult, 'createdAt'>): Promise<void> {
    const ref = collection(this.firestore, 'results');
    return addDoc(ref, { ...result, createdAt: serverTimestamp() }).then(() => undefined);
  }
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

