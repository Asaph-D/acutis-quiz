import { CommonModule } from '@angular/common';
import { Component, computed, effect, inject, signal } from '@angular/core';
import { FormsModule } from '@angular/forms';
import { RouterLink } from '@angular/router';
import { map } from 'rxjs';
import { QuizDataService } from '../../services/quiz-data.service';
import { QuizPart, QuizQuestion } from '../../models/quiz.models';
import { AuthService } from '../../services/auth.service';

type FormState = {
  quizDate: string; // YYYY-MM-DD
  part: QuizPart;
  order: number | null;
  question: string;
  options: [string, string, string, string];
  correctIndex: 0 | 1 | 2 | 3;
  explanation: string;
};

type ImportQuestionDraft = Omit<QuizQuestion, 'id' | 'createdAt'>;

@Component({
  standalone: true,
  selector: 'app-admin-page',
  imports: [CommonModule, FormsModule, RouterLink],
  templateUrl: './admin.page.html',
  styleUrl: './admin.page.sass'
})
export class AdminPage {
  private readonly quizData = inject(QuizDataService);
  private readonly auth = inject(AuthService);

  readonly questions = signal<QuizQuestion[]>([]);
  readonly search = signal('');
  readonly showDailyOnly = signal(false);
  readonly editingId = signal<string | null>(null);
  readonly isEditing = computed(() => !!this.editingId());

  readonly filteredQuestions = computed(() => {
    const q = this.search().trim().toLowerCase();
    return this.questions()
      .filter((item) => {
        if (!q) return true;
        const hay = `${item.question} ${item.partLabel} ${item.quizDate ?? ''}`.toLowerCase();
        return hay.includes(q);
      });
  });

  readonly dailyCount = computed(() => this.questions().length);

  readonly saving = signal(false);
  readonly savedFlash = signal(false);
  readonly errorMsg = signal<string | null>(null);

  readonly importText = signal(DEFAULT_IMPORT_TEXT);
  readonly importModalOpen = signal(false);
  readonly importPreview = signal<ImportQuestionDraft[]>([]);
  readonly importIndex = signal(0);
  readonly importing = signal(false);
  readonly importError = signal<string | null>(null);

  readonly adminEmail = signal('');
  readonly adminPassword = signal('');
  readonly authError = signal<string | null>(null);
  readonly userEmail = signal<string | null>(null);

  readonly isLoggedIn = computed(() => !!this.userEmail());
  readonly authModalOpen = signal(true);

  readonly nextOrder = computed(() => (this.questions().at(-1)?.order ?? 0) + 1);

  readonly form = signal<FormState>({
    quizDate: new Date().toISOString().slice(0, 10),
    part: 'carlo',
    order: null,
    question: '',
    options: ['', '', '', ''],
    correctIndex: 0,
    explanation: ''
  });

  constructor() {
    effect((onCleanup) => {
      const sub = this.quizData.getQuestions$(this.form().quizDate).subscribe((qs) => this.questions.set(qs));
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

  openImport() {
    this.importError.set(null);
    const parsed = this.parseImportText(this.importText(), this.form().quizDate);
    if (!parsed.ok) {
      this.importPreview.set([]);
      this.importIndex.set(0);
      this.importError.set(parsed.error);
      this.importModalOpen.set(true);
      return;
    }
    this.importPreview.set(parsed.questions);
    this.importIndex.set(0);
    this.importModalOpen.set(true);
  }

  closeImport() {
    this.importModalOpen.set(false);
  }

  slideImport(dir: -1 | 1) {
    const max = Math.max(0, this.importPreview().length - 1);
    this.importIndex.set(Math.max(0, Math.min(max, this.importIndex() + dir)));
  }

  goToImport(i: number) {
    const max = Math.max(0, this.importPreview().length - 1);
    this.importIndex.set(Math.max(0, Math.min(max, i)));
  }

  async confirmImport() {
    if (!this.isLoggedIn()) {
      this.importError.set("Connecte-toi en admin pour importer.");
      return;
    }
    const quizDate = this.form().quizDate;
    const qs = this.importPreview();
    if (!qs.length) {
      this.importError.set("Rien à importer.");
      return;
    }
    if (this.importing()) return;
    this.importError.set(null);
    this.importing.set(true);
    try {
      for (const q of qs) {
        await this.quizData.addQuestion(quizDate, {
          part: q.part,
          partLabel: q.partLabel,
          partIcon: q.partIcon,
          order: q.order,
          question: q.question,
          options: q.options,
          correctIndex: q.correctIndex,
          explanation: q.explanation
        });
      }
      this.importModalOpen.set(false);
      this.savedFlash.set(true);
      window.setTimeout(() => this.savedFlash.set(false), 1200);
    } catch {
      this.importError.set("Import impossible. Vérifie les Firestore Rules (écriture sur `quizzes/{date}/questions`).");
    } finally {
      this.importing.set(false);
    }
  }

  private parseImportText(
    raw: string,
    quizDate: string
  ): { ok: true; questions: ImportQuestionDraft[] } | { ok: false; error: string } {
    const trimmedRaw = raw.trim();

    // Mode JSON (ex: tableau d'objets avec explanation)
    if (trimmedRaw.startsWith('[') || trimmedRaw.startsWith('{')) {
      try {
        const parsed = JSON.parse(trimmedRaw) as unknown;
        const arr = Array.isArray(parsed) ? parsed : [parsed];
        if (!arr.length) return { ok: false, error: `JSON vide.` };
        if (arr.length !== 10) return { ok: false, error: `JSON: ${arr.length} questions trouvées. Il en faut 10.` };

        const normPart = (p: unknown): QuizPart | null => {
          const s = String(p ?? '').toLowerCase();
          if (s === 'carlo' || s === 'evangile' || s === 'synthese') return s as QuizPart;
          return null;
        };

        const out: ImportQuestionDraft[] = arr.map((item: any, idx: number) => {
          const order = Number(item?.order ?? idx + 1);
          const part = normPart(item?.part) ?? (order <= 5 ? 'carlo' : order <= 9 ? 'evangile' : 'synthese');
          const partLabel = String(item?.partLabel ?? this.partLabel(part));
          const partIcon = String(item?.partIcon ?? this.partIcon(part));
          const question = String(item?.question ?? '').trim();
          const optionsRaw = item?.options;
          const optionsArr = Array.isArray(optionsRaw) ? optionsRaw.map((x: any) => String(x ?? '').trim()) : [];
          const correctIndex = Number(item?.correctIndex);
          const explanation = String(item?.explanation ?? '—').trim() || '—';

          if (!Number.isFinite(order) || order < 1) throw new Error(`order invalide à l’index ${idx + 1}`);
          if (!question) throw new Error(`question vide (order ${order})`);
          if (optionsArr.length !== 4 || optionsArr.some((x: string) => !x)) throw new Error(`options invalides (order ${order})`);
          if (![0, 1, 2, 3].includes(correctIndex)) throw new Error(`correctIndex invalide (order ${order})`);

          return {
            quizDate,
            part,
            partLabel,
            partIcon,
            order,
            question,
            options: [optionsArr[0]!, optionsArr[1]!, optionsArr[2]!, optionsArr[3]!] as [string, string, string, string],
            correctIndex: correctIndex as 0 | 1 | 2 | 3,
            explanation
          };
        });

        return { ok: true, questions: out.sort((a, b) => a.order - b.order) };
      } catch (e: any) {
        return { ok: false, error: `JSON invalide: ${String(e?.message ?? e)}` };
      }
    }

    const lines = raw
      .split(/\r?\n/g)
      .map((l) => l.trim())
      .filter(Boolean);

    const blocks: Array<{ num: number; question: string; options: string[]; answerLetter: string; explanation?: string }> = [];
    let i = 0;
    while (i < lines.length) {
      const mQ = lines[i]?.match(/^(\d+)\.\s*(.+)$/);
      if (!mQ) {
        i++;
        continue;
      }
      const num = Number(mQ[1]);
      const question = String(mQ[2] ?? '').trim();
      const opts: string[] = [];
      i++;
      while (i < lines.length) {
        const mOpt = lines[i].match(/^[A-D]\)\s*(.+)$/);
        if (!mOpt) break;
        opts.push(String(mOpt[1] ?? '').trim());
        i++;
      }
      const mAns = (lines[i] ?? '').match(/^Réponse\s*:\s*([A-D])\)/i);
      if (!mAns) {
        return { ok: false, error: `Réponse manquante pour la question ${num}. Attendu: "Réponse : X)"` };
      }
      const answerLetter = String(mAns[1]).toUpperCase();
      i++;

      // Explication optionnelle: "Explication : ..."
      let explanation: string | undefined;
      const mExpl = (lines[i] ?? '').match(/^Explication\s*:\s*(.+)$/i);
      if (mExpl) {
        explanation = String(mExpl[1] ?? '').trim();
        i++;
      }

      if (!question) return { ok: false, error: `Question vide pour ${num}.` };
      if (opts.length !== 4) return { ok: false, error: `La question ${num} doit avoir 4 options (A–D).` };

      blocks.push({ num, question, options: opts, answerLetter, explanation });
    }

    if (blocks.length !== 10) {
      return { ok: false, error: `J'ai trouvé ${blocks.length} questions. Il en faut 10.` };
    }

    const toIndex = (letter: string) => (letter === 'A' ? 0 : letter === 'B' ? 1 : letter === 'C' ? 2 : 3);

    const result: ImportQuestionDraft[] = blocks
      .sort((a, b) => a.num - b.num)
      .map((b) => {
        const part: QuizPart = b.num <= 5 ? 'carlo' : 'evangile';
        const partLabel = this.partLabel(part);
        const partIcon = this.partIcon(part);
        return {
          quizDate,
          part,
          partLabel,
          partIcon,
          order: b.num,
          question: b.question,
          options: [b.options[0]!, b.options[1]!, b.options[2]!, b.options[3]!] as [string, string, string, string],
          correctIndex: toIndex(b.answerLetter) as 0 | 1 | 2 | 3,
          explanation: b.explanation?.trim() || '—'
        };
      });

    return { ok: true, questions: result };
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

  setQuizDate(quizDate: string) {
    this.form.set({ ...this.form(), quizDate });
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
      const editingId = this.editingId();
      if (editingId) {
        await this.quizData.updateQuestion(f.quizDate, editingId, {
          part: f.part,
          partLabel: this.partLabel(f.part),
          partIcon: this.partIcon(f.part),
          order,
          question: trimmedQuestion,
          options: trimmedOptions,
          correctIndex: f.correctIndex,
          explanation: trimmedExplanation || '—'
        });
      } else {
        await this.quizData.addQuestion(f.quizDate, {
          part: f.part,
          partLabel: this.partLabel(f.part),
          partIcon: this.partIcon(f.part),
          order,
          question: trimmedQuestion,
          options: trimmedOptions,
          correctIndex: f.correctIndex,
          explanation: trimmedExplanation || '—'
        });
      }

      this.form.set({
        quizDate: f.quizDate,
        part: f.part,
        order: null,
        question: '',
        options: ['', '', '', ''],
        correctIndex: 0,
        explanation: ''
      });
      this.editingId.set(null);

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

  openEdit(q: QuizQuestion) {
    if (!q.id) return;
    this.editingId.set(q.id);
    this.form.set({
      quizDate: q.quizDate ?? this.form().quizDate,
      part: q.part,
      order: q.order ?? null,
      question: q.question,
      options: q.options,
      correctIndex: q.correctIndex,
      explanation: q.explanation
    });
    this.errorMsg.set(null);
    this.savedFlash.set(false);
  }

  cancelEdit() {
    const day = this.form().quizDate;
    this.editingId.set(null);
    this.form.set({
      quizDate: day,
      part: 'carlo',
      order: null,
      question: '',
      options: ['', '', '', ''],
      correctIndex: 0,
      explanation: ''
    });
  }

  async reuseForCurrentQuiz(q: QuizQuestion) {
    if (!this.isLoggedIn()) {
      this.errorMsg.set("Connecte-toi en admin pour réutiliser une question.");
      return;
    }
    const targetDate = this.form().quizDate;
    const next = this.questions()
      .reduce((m, x) => Math.max(m, x.order ?? 0), 0) + 1;

    try {
      await this.quizData.addQuestion(targetDate, {
        part: q.part,
        partLabel: this.partLabel(q.part),
        partIcon: this.partIcon(q.part),
        order: next,
        question: q.question,
        options: q.options,
        correctIndex: q.correctIndex,
        explanation: q.explanation
      });
    } catch {
      this.errorMsg.set("Impossible de réutiliser. Vérifie les Firestore Rules.");
    }
  }

  async deleteQuestion(q: QuizQuestion) {
    if (!this.isLoggedIn()) {
      this.errorMsg.set("Connecte-toi en admin pour supprimer.");
      return;
    }
    if (!q.id) return;
    const ok = window.confirm('Supprimer cette question ?');
    if (!ok) return;
    try {
      await this.quizData.deleteQuestion(this.form().quizDate, q.id);
    } catch {
      this.errorMsg.set("Impossible de supprimer. Vérifie les Firestore Rules.");
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
    } catch (err: any) {
      const code = String(err?.code ?? '');
      if (code === 'auth/unauthorized-domain') {
        this.authError.set(
          "Connexion Google refusée (domaine non autorisé). Dans Firebase Console → Authentication → Settings → Authorized domains, ajoute `localhost`."
        );
      } else if (code === 'auth/popup-blocked') {
        this.authError.set(
          "Popup bloquée par le navigateur. Autorise les popups pour localhost, ou le login passera en mode redirection."
        );
      } else {
        this.authError.set(
          "Connexion Google impossible. Vérifie que le provider Google est activé dans Firebase Authentication (et que `localhost` est autorisé)."
        );
      }
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

const DEFAULT_IMPORT_TEXT = `1. Quelle était la passion principale de Carlo Acutis ?
A) Le sport
B) L’informatique et l’Eucharistie
C) La musique
D) La politique
Réponse : B)
Explication : Carlo était passionné d’informatique et utilisait ses talents pour évangéliser, notamment en créant une exposition sur les miracles eucharistiques.

2. Carlo voyait l’Eucharistie comme :
A) Une tradition
B) Une obligation
C) Une rencontre vivante avec Jésus
D) Un symbole
Réponse : C)
Explication : Pour Carlo, l’Eucharistie n’était pas un simple symbole mais une vraie rencontre avec Jésus vivant.

3. Où se trouve le corps de Carlo aujourd’hui ?
A) Rome
B) Milan
C) Assise
D) Paris
Réponse : C)
Explication : Le corps de Carlo Acutis est exposé à Assise, en Italie, lieu très symbolique lié à saint François.

4. Quel âge avait Carlo à sa mort ?
A) 13 ans
B) 15 ans
C) 18 ans
D) 20 ans
Réponse : B)
Explication : Carlo est mort à seulement 15 ans, mais sa vie a profondément marqué l’Église.

5. Carlo utilisait Internet pour :
A) Jouer uniquement
B) Évangéliser
C) Regarder des films
D) Gagner de l’argent
Réponse : B)
Explication : Il utilisait Internet comme un outil d’évangélisation pour faire connaître Jésus au monde.

6. Que demande la foule à Jésus ?
A) Un miracle
B) Un signe pour croire
C) De l’argent
D) Une guérison
Réponse : B)
Explication : La foule demande un signe pour croire, montrant qu’elle cherche encore des preuves visibles.

7. Quel personnage est mentionné comme ayant donné le pain dans le désert ?
A) Abraham
B) Moïse
C) David
D) Élie
Réponse : B)
Explication : La foule évoque Moïse, qui avait donné la manne dans le désert selon la tradition.

8. Jésus dit que le vrai pain vient :
A) Du travail humain
B) Du ciel
C) Du temple
D) Des apôtres
Réponse : B)
Explication : Jésus explique que le vrai pain vient du ciel et donne la vie au monde.

9. Jésus affirme : « Je suis… »
A) Le chemin
B) La lumière
C) Le pain de vie
D) Le berger
Réponse : C)
Explication : Jésus se révèle comme le Pain de vie, essentiel pour la vie spirituelle.

10. Celui qui vient à Jésus…
A) Aura de l’or
B) N’aura plus jamais faim
C) Deviendra riche
D) Sera célèbre
Réponse : B)
Explication : Jésus promet que celui qui vient à Lui n’aura plus jamais faim, parlant d’une faim spirituelle comblée.
`;

