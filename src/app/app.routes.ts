import { Routes } from '@angular/router';
import { QuizPage } from './pages/quiz/quiz.page';
import { AdminPage } from './pages/admin/admin.page';
import { AnalyticsPage } from './pages/analytics/analytics.page';

export const routes: Routes = [
  { path: '', pathMatch: 'full', redirectTo: 'quiz' },
  { path: 'quiz', component: QuizPage },
  { path: 'admin', component: AdminPage },
  { path: 'analytics', component: AnalyticsPage },
  { path: '**', redirectTo: 'quiz' }
];
