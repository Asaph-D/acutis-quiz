import { CommonModule } from '@angular/common';
import { Component, computed, effect, inject, signal } from '@angular/core';
import { FormsModule } from '@angular/forms';
import { map } from 'rxjs';
import { QuizDataService } from '../../services/quiz-data.service';
import { QuizPart, QuizQuestion } from '../../models/quiz.models';
import { AuthService } from '../../services/auth.service';

type FormState = {
  part: QuizPart;
  order: number | null;
  question: string;
  options: [string, string, string, string];
  correctIndex: 0 | 1 | 2 | 3;
  explanation: string;
};

@Component({
  standalone: true,
  selector: 'app-admin-page',
  imports: [CommonModule, FormsModule],
  templateUrl: './admin.page.html',
  styleUrl: './admin.page.sass'
})
export class AdminPage {
  private readonly quizData = inject(QuizDataService);
  private readonly auth = inject(AuthService);

  readonly questions = signal<QuizQuestion[]>([]);
  readonly saving = signal(false);
  readonly savedFlash = signal(false);
  readonly errorMsg = signal<string | null>(null);

  readonly adminEmail = signal('');
  readonly adminPassword = signal('');
  readonly authError = signal<string | null>(null);
  readonly userEmail = signal<string | null>(null);

  readonly isLoggedIn = computed(() => !!this.userEmail());
  readonly authModalOpen = signal(true);

  readonly nextOrder = computed(() => (this.questions().at(-1)?.order ?? 0) + 1);

  readonly form = signal<FormState>({
    part: 'carlo',
    order: null,
    question: '',
    options: ['', '', '', ''],
    correctIndex: 0,
    explanation: ''
  });

  constructor() {
    effect((onCleanup) => {
      const sub = this.quizData.getQuestions$().subscribe((qs) => this.questions.set(qs));
      const subAuth = this.auth.user$
        .pipe(map((u) => u?.email ?? null))
        .subscribe((email) => {
          this.userEmail.set(email);
          this.authModalOpen.set(!email);
        });
      onCleanup(() => {
        sub.unsubscribe();
        subAuth.unsubscribe();
      });
    });
  }

  partLabel(part: QuizPart) {
    if (part === 'carlo') return 'Partie 1 — St Carlo Acutis';
    if (part === 'evangile') return 'Partie 2 — Évangile';
    return 'Synthèse';
  }

  partIcon(part: QuizPart) {
    if (part === 'carlo') return 'computer';
    if (part === 'evangile') return 'menu_book';
    return 'link';
  }

  setPart(part: QuizPart) {
    this.form.set({ ...this.form(), part });
  }

  setOrder(value: string | number | null) {
    const n =
      value === '' || value === null || value === undefined ? null : Number(value);
    this.form.set({ ...this.form(), order: Number.isFinite(n as number) ? (n as number) : null });
  }

  setQuestion(question: string) {
    this.form.set({ ...this.form(), question });
  }

  setExplanation(explanation: string) {
    this.form.set({ ...this.form(), explanation });
  }

  setCorrectIndex(value: unknown) {
    const n = Number(value);
    const v = n as 0 | 1 | 2 | 3;
    if (v !== 0 && v !== 1 && v !== 2 && v !== 3) return;
    this.form.set({ ...this.form(), correctIndex: v });
  }

  setOption(i: number, value: string) {
    const v = i as 0 | 1 | 2 | 3;
    if (v !== 0 && v !== 1 && v !== 2 && v !== 3) return;
    const f = this.form();
    const opts: FormState['options'] = [...f.options] as FormState['options'];
    opts[v] = value;
    this.form.set({ ...f, options: opts });
  }

  async submit() {
    if (!this.isLoggedIn()) {
      this.errorMsg.set("Connecte-toi en admin pour écrire dans Firestore.");
      return;
    }
    if (this.saving()) return;
    this.errorMsg.set(null);

    const f = this.form();
    const order = f.order ?? this.nextOrder();

    const trimmedQuestion = f.question.trim();
    const trimmedExplanation = f.explanation.trim();
    const trimmedOptions = f.options.map((o) => o.trim()) as FormState['options'];

    if (!trimmedQuestion) {
      this.errorMsg.set('La question est obligatoire.');
      return;
    }
    if (trimmedOptions.some((o) => !o)) {
      this.errorMsg.set('Les 4 options sont obligatoires.');
      return;
    }

    this.saving.set(true);
    try {
      await this.quizData.addQuestion({
        part: f.part,
        partLabel: this.partLabel(f.part),
        partIcon: this.partIcon(f.part),
        order,
        question: trimmedQuestion,
        options: trimmedOptions,
        correctIndex: f.correctIndex,
        explanation: trimmedExplanation || '—'
      });

      this.form.set({
        part: f.part,
        order: null,
        question: '',
        options: ['', '', '', ''],
        correctIndex: 0,
        explanation: ''
      });

      this.savedFlash.set(true);
      window.setTimeout(() => this.savedFlash.set(false), 1200);
    } catch {
      this.errorMsg.set(
        "Impossible d'enregistrer. Vérifie les Firestore Rules (écriture sur `questions`)."
      );
    } finally {
      this.saving.set(false);
    }
  }

  async login() {
    this.authError.set(null);
    const email = this.adminEmail().trim();
    const password = this.adminPassword();
    if (!email || !password) {
      this.authError.set("Email et mot de passe requis.");
      return;
    }
    try {
      await this.auth.login(email, password);
      this.adminPassword.set('');
    } catch {
      this.authError.set("Connexion impossible. Vérifie l'email/mot de passe dans Firebase Auth.");
    }
  }

  async loginWithGoogle() {
    this.authError.set(null);
    try {
      await this.auth.loginWithGoogle();
    } catch {
      this.authError.set(
        "Connexion Google impossible. Vérifie que le provider Google est activé dans Firebase Authentication."
      );
    }
  }

  async logout() {
    this.authError.set(null);
    try {
      await this.auth.logout();
    } catch {
      this.authError.set("Déconnexion impossible.");
    }
  }
}

