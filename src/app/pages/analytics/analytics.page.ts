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

  readonly leaderboardGroups = computed(() => {
    const sortedAll = [...this.results()].sort((a, b) => {
      const scoreDiff = (b.score ?? 0) - (a.score ?? 0);
      if (scoreDiff !== 0) return scoreDiff;
      // ex æquo: du premier à avoir ce score au dernier
      return this.createdAtMillis(a.createdAt) - this.createdAtMillis(b.createdAt);
    });

    // Top 10 + tous les ex æquo du 10e (pour qu'ils soient tous visibles)
    let cutScore: number | null = null;
    if (sortedAll.length > 10) {
      cutScore = sortedAll[9]?.score ?? 0;
    }
    const visible = cutScore === null ? sortedAll : sortedAll.filter((r) => (r.score ?? 0) >= cutScore);

    const groups: Array<{ score: number; entries: QuizResult[] }> = [];
    for (const r of visible) {
      const s = r.score ?? 0;
      const last = groups[groups.length - 1];
      if (last && last.score === s) last.entries.push(r);
      else groups.push({ score: s, entries: [r] });
    }

    let higherCount = 0;
    return groups.map((g) => {
      const rank = higherCount + 1; // "competition ranking": 1, 1, 3... (mais groupé => 1, 3, 5...)
      higherCount += g.entries.length;
      return {
        id: `rank:${rank}|score:${g.score}`,
        rank,
        score: g.score,
        entries: g.entries,
        isTie: g.entries.length > 1
      };
    });
  });

  private createdAtMillis(v: unknown): number {
    if (!v) return 0;
    const anyV: any = v as any;
    if (typeof anyV?.toMillis === 'function') return Number(anyV.toMillis()) || 0;
    // Firestore Timestamp-like
    if (typeof anyV?.seconds === 'number') return anyV.seconds * 1000 + Math.floor((anyV.nanoseconds ?? 0) / 1e6);
    // Date or ISO string fallback
    if (anyV instanceof Date) return anyV.getTime();
    if (typeof anyV === 'string') {
      const t = Date.parse(anyV);
      return Number.isFinite(t) ? t : 0;
    }
    return 0;
  }

  nameSummary(entries: QuizResult[]) {
    const first = entries[0]?.displayName?.trim() || 'Anonyme';
    const extra = Math.max(0, entries.length - 1);
    return extra > 0 ? `${first} +${extra}` : first;
  }

  nameSummaryParts(entries: QuizResult[]) {
    const first = entries[0]?.displayName?.trim() || 'Anonyme';
    const extra = Math.max(0, entries.length - 1);
    return {
      first,
      extra,
      extraLabel: extra > 0 ? `+${extra}` : ''
    };
  }

  tieNamesPreview(entries: QuizResult[], maxNames = 4) {
    const rest = entries
      .slice(1)
      .map((e) => (e.displayName?.trim() || 'Anonyme'))
      .filter(Boolean);
    return {
      names: rest.slice(0, Math.max(0, maxNames)),
      hasMore: rest.length > maxNames
    };
  }

  readonly drawerOpen = signal(false);
  readonly drawerGroupId = signal<string | null>(null);

  readonly drawerGroup = computed(() => {
    const id = this.drawerGroupId();
    if (!id) return null;
    return this.leaderboardGroups().find((g) => g.id === id) ?? null;
  });

  openGroup(id: string) {
    if (!this.isLoggedIn()) return;
    this.drawerGroupId.set(id);
    this.drawerOpen.set(true);
  }

  closeDrawer() {
    this.drawerOpen.set(false);
    this.drawerGroupId.set(null);
  }

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

