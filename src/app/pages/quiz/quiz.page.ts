import { CommonModule } from '@angular/common';
import { Component, computed, effect, inject, signal } from '@angular/core';
import { QuizDataService } from '../../services/quiz-data.service';
import { QuizQuestion } from '../../models/quiz.models';

const LETTERS = ['A', 'B', 'C', 'D'] as const;

@Component({
  standalone: true,
  selector: 'app-quiz-page',
  imports: [CommonModule],
  templateUrl: './quiz.page.html',
  styleUrl: './quiz.page.sass'
})
export class QuizPage {
  private readonly quizData = inject(QuizDataService);

  readonly questions = signal<QuizQuestion[]>([]);
  readonly current = signal(0);
  readonly answers = signal<Array<0 | 1 | 2 | 3 | null>>([]);
  readonly answered = signal<boolean[]>([]);
  readonly showResults = signal(false);
  readonly saving = signal(false);

  readonly doneCount = computed(() => this.answered().filter(Boolean).length);
  readonly totalCount = computed(() => this.questions().length);
  readonly progressPct = computed(() => (this.totalCount() ? (this.doneCount() / this.totalCount()) * 100 : 0));
  readonly currentQuestion = computed(() => this.questions()[this.current()]);

  readonly score = computed(() => {
    const qs = this.questions();
    const a = this.answers();
    let s = 0;
    for (let i = 0; i < qs.length; i++) {
      if (a[i] !== null && a[i] === qs[i]?.correctIndex) s++;
    }
    return s;
  });

  readonly resultTitle = computed(() => {
    const s = this.score();
    const t = this.totalCount();
    if (!t) return '';
    if (s === t) return 'Parfait !';
    if (s >= Math.ceil(t * 0.8)) return 'Excellent !';
    if (s >= Math.ceil(t * 0.6)) return 'Bien joué !';
    if (s >= Math.ceil(t * 0.4)) return 'Pas mal !';
    return 'Courage !';
  });

  readonly resultMsg = computed(() => {
    const s = this.score();
    const t = this.totalCount();
    if (!t) return '';
    if (s === t) return 'Tu es digne de Carlo lui-même. Continue sur ce chemin.';
    if (s >= Math.ceil(t * 0.8)) return "Tu connais vraiment bien Carlo et l'Évangile. Superbe !";
    if (s >= Math.ceil(t * 0.6)) return 'Belle performance. Continue à approfondir.';
    if (s >= Math.ceil(t * 0.4)) return 'De bonnes bases. Un peu de révision et tu y es !';
    return "La foi est un chemin. Tu peux recommencer quand tu veux.";
  });

  // Carrousel de correction (fin)
  readonly resultIndex = signal(0);
  readonly resultTrackTransform = computed(() => `translateX(-${this.resultIndex() * 100}%)`);

  constructor() {
    effect((onCleanup) => {
      const sub = this.quizData.getQuestions$().subscribe((qs) => {
        this.questions.set(qs);
        this.answers.set(new Array(qs.length).fill(null));
        this.answered.set(new Array(qs.length).fill(false));
        this.current.set(0);
        this.showResults.set(false);
        this.resultIndex.set(0);
      });
      onCleanup(() => sub.unsubscribe());
    });
  }

  letter(i: number) {
    return LETTERS[i] ?? '';
  }

  canPrev() {
    return this.current() > 0;
  }

  canNext() {
    return this.current() < this.totalCount() - 1;
  }

  goTo(idx: number) {
    if (idx < 0 || idx >= this.totalCount()) return;
    this.current.set(idx);
  }

  prev() {
    if (!this.canPrev()) return;
    this.current.update((v) => v - 1);
  }

  next() {
    if (!this.canNext()) return;
    this.current.update((v) => v + 1);
  }

  selectAnswer(optIndex: 0 | 1 | 2 | 3) {
    const idx = this.current();
    if (this.answered()[idx]) return;

    const a = [...this.answers()];
    a[idx] = optIndex;
    this.answers.set(a);

    const d = [...this.answered()];
    d[idx] = true;
    this.answered.set(d);

    // auto-advance
    const isCorrect = this.questions()[idx]?.correctIndex === optIndex;
    const delay = isCorrect ? 900 : 1200;
    if (idx < this.totalCount() - 1) {
      window.setTimeout(() => {
        if (this.current() === idx) this.next();
      }, delay);
    } else {
      window.setTimeout(() => this.finish(), 1100);
    }
  }

  selectAnswerByIndex(optIndex: number) {
    const v = optIndex as 0 | 1 | 2 | 3;
    if (v !== 0 && v !== 1 && v !== 2 && v !== 3) return;
    this.selectAnswer(v);
  }

  async finish() {
    this.showResults.set(true);
    this.resultIndex.set(0);

    // Sauvegarde (best effort) — si Firestore rules bloquent, ça n'empêche pas l'affichage.
    if (this.saving()) return;
    this.saving.set(true);
    try {
      await this.quizData.saveResult({
        displayName: 'Anonyme',
        total: this.totalCount(),
        score: this.score(),
        answers: this.answers()
      });
    } catch {
      // silence: l'UI doit rester fluide même sans permissions
    } finally {
      this.saving.set(false);
    }
  }

  restart() {
    const qs = this.questions();
    this.answers.set(new Array(qs.length).fill(null));
    this.answered.set(new Array(qs.length).fill(false));
    this.current.set(0);
    this.showResults.set(false);
    this.resultIndex.set(0);
  }

  // Carrousel controls
  slideResult(dir: -1 | 1) {
    const next = this.resultIndex() + dir;
    this.resultIndex.set(Math.max(0, Math.min(this.totalCount() - 1, next)));
  }

  goToResult(i: number) {
    this.resultIndex.set(Math.max(0, Math.min(this.totalCount() - 1, i)));
  }

  isCorrect(i: number) {
    const q = this.questions()[i];
    const a = this.answers()[i];
    return a !== null && q && a === q.correctIndex;
  }

  chosenLabel(i: number) {
    const q = this.questions()[i];
    const a = this.answers()[i];
    if (!q) return '—';
    if (a === null) return '— Sans réponse';
    return `${this.letter(a)}) ${q.options[a]}`;
  }
}

