import { Routes } from '@angular/router';
import { QuizPage } from './pages/quiz/quiz.page';

export const routes: Routes = [
  { path: '', pathMatch: 'full', redirectTo: 'quiz' },
  { path: 'quiz', component: QuizPage },
  { path: '**', redirectTo: 'quiz' }
];
