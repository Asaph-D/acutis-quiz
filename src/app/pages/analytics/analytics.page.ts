import { CommonModule } from '@angular/common';
import { Component, computed, effect, inject, signal } from '@angular/core';
import { RouterLink } from '@angular/router';
import { map } from 'rxjs';
import { QuizDataService } from '../../services/quiz-data.service';
import { QuizQuestion, QuizResult } from '../../models/quiz.models';
import { AuthService } from '../../services/auth.service';

@Component({
  standalone: true,
  selector: 'app-analytics-page',
  imports: [CommonModule, RouterLink],
  templateUrl: './analytics.page.html',
  styleUrl: './analytics.page.sass'
})
export class AnalyticsPage {
  private readonly quizData = inject(QuizDataService);
  private readonly auth = inject(AuthService);
  readonly Math = Math;
  private readonly quizDate = new Date().toISOString().slice(0, 10);

  readonly questions = signal<QuizQuestion[]>([]);
  readonly results = signal<QuizResult[]>([]);
  readonly errorMsg = signal<string | null>(null);
  readonly userEmail = signal<string | null>(null);
  readonly isLoggedIn = computed(() => !!this.userEmail());

  // carrousel stats par question
  readonly qIndex = signal(0);
  readonly qTrackTransform = computed(() => `translateX(-${this.qIndex() * 100}%)`);

  readonly participantCount = computed(() => this.results().length);
  readonly averageScore = computed(() => {
    const rs = this.results();
    if (!rs.length) return 0;
    const sum = rs.reduce((acc, r) => acc + (r.score ?? 0), 0);
    return Math.round((sum / rs.length) * 10) / 10;
  });
  readonly bestScore = computed(() => Math.max(0, ...this.results().map((r) => r.score ?? 0)));
  readonly totalCount = computed(() => this.questions().length || (this.results()[0]?.total ?? 0));

  readonly leaderboard = computed(() => {
    return [...this.results()]
      .sort((a, b) => (b.score ?? 0) - (a.score ?? 0))
      .slice(0, 10);
  });

  readonly perQuestion = computed(() => {
    const qs = this.questions();
    const rs = this.results();
    if (!qs.length) return [];

    return qs.map((q, i) => {
      let answered = 0;
      let correct = 0;
      for (const r of rs) {
        const a = r.answers?.[i] ?? null;
        if (a === null || a === undefined) continue;
        answered++;
        if (a === q.correctIndex) correct++;
      }
      const rate = answered ? correct / answered : 0;
      return { q, index: i, answered, correct, rate };
    });
  });

  constructor() {
    effect((onCleanup) => {
      const sub1 = this.quizData.getQuestions$(this.quizDate).subscribe((qs) => this.questions.set(qs));
      const subAuth = this.auth.user$
        .pipe(map((u) => u?.email ?? null))
        .subscribe((email) => this.userEmail.set(email));
      const sub2 = this.quizData.getResults$(this.quizDate).subscribe({
        next: (rs) => this.results.set(rs),
        error: () => this.errorMsg.set(
          "Impossible de lire les résultats. Connecte-toi en admin."
        )
      });
      onCleanup(() => {
        sub1.unsubscribe();
        sub2.unsubscribe();
        subAuth.unsubscribe();
      });
    });
  }

  slide(dir: -1 | 1) {
    const max = Math.max(0, this.perQuestion().length - 1);
    this.qIndex.set(Math.max(0, Math.min(max, this.qIndex() + dir)));
  }

  goTo(i: number) {
    const max = Math.max(0, this.perQuestion().length - 1);
    this.qIndex.set(Math.max(0, Math.min(max, i)));
  }
}

