import { Injectable } from '@angular/core';
import {
  Auth,
  GoogleAuthProvider,
  User,
  getRedirectResult,
  signInWithEmailAndPassword,
  signInWithPopup,
  signInWithRedirect,
  signOut
} from '@angular/fire/auth';
import { Observable } from 'rxjs';

@Injectable({ providedIn: 'root' })
export class AuthService {
  readonly user$: Observable<User | null>;
  private readonly googleProvider = new GoogleAuthProvider();

  constructor(private readonly auth: Auth) {
    this.user$ = new Observable<User | null>((subscriber) => {
      const unsub = this.auth.onAuthStateChanged(
        (user) => subscriber.next(user),
        (err) => subscriber.error(err),
        () => subscriber.complete()
      );
      return { unsubscribe: () => unsub() };
    });

    // Si on est revenu d'un login Google via redirect, finalise la session.
    // (Best effort : on ignore les erreurs, l'UI affichera le statut auth via onAuthStateChanged.)
    void this.initRedirectResult();
  }

  async initRedirectResult() {
    try {
      await getRedirectResult(this.auth);
    } catch {
      // silence
    }
  }

  login(email: string, password: string) {
    return signInWithEmailAndPassword(this.auth, email, password);
  }

  async loginWithGoogle() {
    try {
      return await signInWithPopup(this.auth, this.googleProvider);
    } catch (err: any) {
      const code = String(err?.code ?? '');
      // Si la popup est bloquée/fermée, le redirect est plus fiable.
      if (
        code === 'auth/popup-blocked' ||
        code === 'auth/popup-closed-by-user' ||
        code === 'auth/cancelled-popup-request'
      ) {
        await signInWithRedirect(this.auth, this.googleProvider);
        return null;
      }
      throw err;
    }
  }

  logout() {
    return signOut(this.auth);
  }
}

