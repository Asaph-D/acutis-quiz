import { CommonModule } from '@angular/common';
import { Component, computed, effect, inject, signal } from '@angular/core';
import { FormsModule } from '@angular/forms';
import { ActivatedRoute } from '@angular/router';
import { DomSanitizer, SafeHtml } from '@angular/platform-browser';
import { QuizDataService } from '../../services/quiz-data.service';
import { QuizQuestion } from '../../models/quiz.models';
import { AelfService, AelfGospel } from '../../services/aelf.service';

const LETTERS = ['A', 'B', 'C', 'D'] as const;
const LS_VERSION = 1;

@Component({
  standalone: true,
  selector: 'app-quiz-page',
  imports: [CommonModule, FormsModule],
  templateUrl: './quiz.page.html',
  styleUrl: './quiz.page.sass'
})
export class QuizPage {
  private readonly quizData = inject(QuizDataService);
  private readonly route = inject(ActivatedRoute);
  private readonly aelf = inject(AelfService);
  private readonly sanitizer = inject(DomSanitizer);

  private readonly sfxCorrect = this.createSfx('assets/effects/correct.mp3', 0.7);
  private readonly sfxIncorrect = this.createSfx('assets/effects/incorrect.mp3', 0.7);
  private readonly sfxEndQuiz = this.createSfx('assets/effects/end-quiz.mp3', 0.8);

  readonly displayName = signal('');
  readonly nameTouched = signal(false);
  readonly started = signal(false);
  readonly nameError = signal<string | null>(null);

  readonly questions = signal<QuizQuestion[]>([]);
  readonly current = signal(0);
  readonly answers = signal<Array<0 | 1 | 2 | 3 | null>>([]);
  readonly answered = signal<boolean[]>([]);
  readonly showResults = signal(false);
  readonly saving = signal(false);

  readonly hasName = computed(() => this.displayName().trim().length > 0);
  readonly quizDate = signal(new Date().toISOString().slice(0, 10)); // YYYY-MM-DD
  readonly resumeAvailable = signal(false);
  readonly resumeName = signal<string | null>(null);
  readonly resumeDismissed = signal(false);

  // Évangile du jour (AELF)
  readonly gospelModalOpen = signal(false);
  readonly gospelModalClosing = signal(false);
  readonly gospelLoading = signal(false);
  readonly gospelError = signal<string | null>(null);
  readonly gospel = signal<AelfGospel | null>(null);
  readonly gospelHtml = computed<SafeHtml | null>(() => {
    const g = this.gospel();
    if (!g?.html) return null;
    return this.sanitizer.bypassSecurityTrustHtml(g.html);
  });

  readonly doneCount = computed(() => this.answered().filter(Boolean).length);
  readonly totalCount = computed(() => this.questions().length);
  readonly progressPct = computed(() => (this.totalCount() ? (this.doneCount() / this.totalCount()) * 100 : 0));
  readonly currentQuestion = computed(() => this.questions()[this.current()]);
  readonly gospelShortRef = computed(() => {
    const g = this.gospel();
    if (!g?.ref) return null;
    // ex: "Jn 6, 22-29" => "Jn 6,22-29"
    return g.ref.replace(/\s+/g, ' ').replace(/\s*,\s*/g, ',').trim();
  });

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

  private gospelCloseTimer: number | null = null;
  private readonly gospelModalAnimMs = 180;

  constructor() {
    // Nettoyage: supprime les sessions locales d'autres jours pour éviter la confusion
    this.cleanupOldProgress();

    // Tag (date) pilotable par URL: /quiz?date=YYYY-MM-DD
    effect((onCleanup) => {
      const sub = this.route.queryParamMap.subscribe((pm) => {
        const d = pm.get('date');
        if (d && /^\d{4}-\d{2}-\d{2}$/.test(d)) this.quizDate.set(d);
      });
      onCleanup(() => sub.unsubscribe());
    });

    effect((onCleanup) => {
      const sub = this.quizData.getQuestions$(this.quizDate()).subscribe((qs) => {
        const limited = qs.slice(0, 10);
        this.questions.set(limited);
        this.answers.set(new Array(limited.length).fill(null));
        this.answered.set(new Array(limited.length).fill(false));
        this.current.set(0);
        this.showResults.set(false);
        this.resultIndex.set(0);
        this.displayName.set('');
        this.nameTouched.set(false);
        this.started.set(false);
        this.nameError.set(null);
        this.resumeAvailable.set(false);
        this.resumeName.set(null);
        this.resumeDismissed.set(false);

        // propose de reprendre si une session locale existe
        const saved = this.readSavedSession();
        if (saved) {
          this.resumeAvailable.set(true);
          this.resumeName.set(saved.displayName);
        }
      });
      onCleanup(() => sub.unsubscribe());
    });

    // Charge l'évangile du jour (pour révision avant de commencer)
    effect((onCleanup) => {
      const date = this.quizDate();
      let alive = true;
      this.gospelLoading.set(true);
      this.gospelError.set(null);
      const sub = this.aelf.getGospel$(date, 'romain').subscribe({
        next: (g) => {
          if (!alive) return;
          this.gospel.set(g);
          this.gospelLoading.set(false);
          if (!g) this.gospelError.set("Évangile indisponible pour cette date.");
        },
        error: () => {
          if (!alive) return;
          this.gospel.set(null);
          this.gospelLoading.set(false);
          this.gospelError.set("Impossible de charger l’Évangile du jour.");
        }
      });
      onCleanup(() => {
        alive = false;
        sub.unsubscribe();
      });
    });

    // Si l'utilisateur a cliqué "Recommencer" mais retape le même nom,
    // on repropose automatiquement la reprise.
    effect(() => {
      if (!this.resumeDismissed()) return;
      if (this.started() || this.showResults()) return;
      const saved = this.readSavedSession();
      if (!saved) return;
      const typed = this.displayName().trim().toLowerCase();
      if (!typed) return;
      if (typed === saved.displayName.trim().toLowerCase()) {
        this.resumeAvailable.set(true);
        this.resumeName.set(saved.displayName);
        this.resumeDismissed.set(false);
      }
    });

    // persistance locale (uniquement quand le quiz est en cours)
    effect(() => {
      if (!this.started() || this.showResults()) return;
      this.persistProgress();
    });
  }

  openGospel() {
    if (this.gospelCloseTimer !== null) {
      window.clearTimeout(this.gospelCloseTimer);
      this.gospelCloseTimer = null;
    }
    this.gospelModalClosing.set(false);
    this.gospelModalOpen.set(true);
  }

  closeGospel() {
    if (!this.gospelModalOpen()) return;
    if (this.gospelModalClosing()) return;
    this.gospelModalClosing.set(true);
    if (this.gospelCloseTimer !== null) window.clearTimeout(this.gospelCloseTimer);
    this.gospelCloseTimer = window.setTimeout(() => {
      this.gospelModalOpen.set(false);
      this.gospelModalClosing.set(false);
      this.gospelCloseTimer = null;
    }, this.gospelModalAnimMs);
  }

  private storageKey(quizDate: string) {
    return `acutis-quiz:progress:${quizDate}`;
  }

  private cleanupOldProgress() {
    try {
      const today = new Date().toISOString().slice(0, 10);
      const keepKey = this.storageKey(today);
      const prefix = 'acutis-quiz:progress:';
      const keys: string[] = [];
      for (let i = 0; i < localStorage.length; i++) {
        const k = localStorage.key(i);
        if (k) keys.push(k);
      }
      for (const k of keys) {
        if (!k.startsWith(prefix)) continue;
        if (k === keepKey) continue;
        localStorage.removeItem(k);
      }
    } catch {
      // ignore
    }
  }

  private readSavedSession(): SavedSession | null {
    try {
      const raw = localStorage.getItem(this.storageKey(this.quizDate()));
      if (!raw) return null;
      const parsed = JSON.parse(raw) as SavedSession;
      if (!parsed || parsed.v !== LS_VERSION) return null;
      if (parsed.quizDate !== this.quizDate()) return null;
      if (!parsed.displayName) return null;
      return parsed;
    } catch {
      return null;
    }
  }

  private persistProgress() {
    const payload: SavedSession = {
      v: LS_VERSION,
      quizDate: this.quizDate(),
      displayName: this.displayName().trim(),
      started: this.started(),
      current: this.current(),
      answers: this.answers(),
      answered: this.answered()
    };
    try {
      localStorage.setItem(this.storageKey(payload.quizDate), JSON.stringify(payload));
    } catch {
      // ignore quota errors
    }
  }

  private clearProgress() {
    try {
      localStorage.removeItem(this.storageKey(this.quizDate()));
    } catch {
      // ignore
    }
  }

  resumeSaved() {
    const saved = this.readSavedSession();
    if (!saved) {
      this.resumeAvailable.set(false);
      this.resumeName.set(null);
      return;
    }
    this.displayName.set(saved.displayName);
    this.nameTouched.set(true);
    this.started.set(true);
    this.current.set(Math.max(0, Math.min((this.totalCount() || 1) - 1, saved.current ?? 0)));

    const len = this.totalCount();
    const a = (saved.answers ?? []).slice(0, len) as Array<0 | 1 | 2 | 3 | null>;
    const d = (saved.answered ?? []).slice(0, len) as boolean[];
    this.answers.set([...a, ...new Array(Math.max(0, len - a.length)).fill(null)]);
    this.answered.set([...d, ...new Array(Math.max(0, len - d.length)).fill(false)]);

    this.resumeAvailable.set(false);
    this.resumeName.set(null);
    this.resumeDismissed.set(false);
    this.nameError.set(null);
  }

  dismissSavedPrompt() {
    this.resumeAvailable.set(false);
    this.resumeName.set(null);
    this.resumeDismissed.set(true);
  }

  letter(i: number) {
    return LETTERS[i] ?? '';
  }

  isCorrectAt(i: number) {
    const q = this.questions()[i];
    const a = this.answers()[i] ?? null;
    return a !== null && !!q && a === q.correctIndex;
  }

  isWrongAt(i: number) {
    const q = this.questions()[i];
    const a = this.answers()[i] ?? null;
    return a !== null && !!q && a !== q.correctIndex;
  }

  private createSfx(src: string, volume: number) {
    try {
      const a = new Audio(src);
      a.preload = 'auto';
      a.volume = volume;
      return a;
    } catch {
      return null;
    }
  }

  private playSfx(audio: HTMLAudioElement | null) {
    if (!audio) return;
    try {
      audio.currentTime = 0;
      void audio.play();
    } catch {
      // silence (autoplay policy / erreur decode)
    }
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
    if (!this.started()) return;
    if (!this.canPrev()) return;
    this.current.update((v) => v - 1);
  }

  next() {
    if (!this.started()) return;
    if (!this.canNext()) return;
    this.current.update((v) => v + 1);
  }

  selectAnswer(optIndex: 0 | 1 | 2 | 3) {
    if (!this.started()) return;
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
    this.playSfx(isCorrect ? this.sfxCorrect : this.sfxIncorrect);
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
    if (!this.started()) return;
    this.showResults.set(true);
    this.resultIndex.set(0);
    this.playSfx(this.sfxEndQuiz);

    // Sauvegarde (best effort) — si Firestore rules bloquent, ça n'empêche pas l'affichage.
    if (this.saving()) return;
    this.saving.set(true);
    try {
      await this.quizData.saveResult(this.quizDate(), {
        displayName: this.displayName().trim(),
        total: this.totalCount(),
        score: this.score(),
        answers: this.answers()
      });
      this.clearProgress();
    } catch {
      // silence: l'UI doit rester fluide même sans permissions
    } finally {
      this.saving.set(false);
    }
  }

  async startQuiz() {
    this.nameTouched.set(true);
    this.nameError.set(null);
    const name = this.displayName().trim();
    if (!name) return;

    // Si une session locale existe pour ce nom, repropose la reprise.
    const saved = this.readSavedSession();
    if (saved && saved.displayName.trim().toLowerCase() === name.toLowerCase()) {
      this.resumeAvailable.set(true);
      this.resumeName.set(saved.displayName);
      this.resumeDismissed.set(false);
      return;
    }

    // Réservation du nom sans lecture (compatible rules publiques)
    try {
      await this.quizData.reserveDisplayName(this.quizDate(), name);
    } catch {
      this.nameError.set("Ce nom existe déjà aujourd'hui. Choisis-en un autre pour éviter les doublons.");
      return;
    }

    this.started.set(true);
  }

  restart() {
    const qs = this.questions();
    this.answers.set(new Array(qs.length).fill(null));
    this.answered.set(new Array(qs.length).fill(false));
    this.current.set(0);
    this.showResults.set(false);
    this.resultIndex.set(0);
    // Quiz journalier: pour rejouer le même jour, il faut un autre nom
    this.displayName.set('');
    this.nameTouched.set(false);
    this.started.set(false);
    this.nameError.set(null);
    this.clearProgress();
    this.resumeAvailable.set(false);
    this.resumeName.set(null);
    this.resumeDismissed.set(false);
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

  partLabel(q: QuizQuestion | null | undefined) {
    if (!q) return '';
    if (q.part !== 'evangile') return q.partLabel ?? '';
    const d = this.quizDate();
    const ref = this.gospelShortRef();
    // Si AELF est dispo: rend le libellé vraiment "journalier"
    if (ref) return `Partie 2 — Évangile du ${d} (${ref})`;
    // Fallback: libellé stocké (Firestore / défaut)
    return q.partLabel ?? `Partie 2 — Évangile du ${d}`;
  }
}

type SavedSession = {
  v: number;
  quizDate: string;
  displayName: string;
  started: boolean;
  current: number;
  answers: Array<0 | 1 | 2 | 3 | null>;
  answered: boolean[];
};

