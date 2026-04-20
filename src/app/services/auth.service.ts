import { Injectable } from '@angular/core';
import {
  Auth,
  GoogleAuthProvider,
  User,
  signInWithEmailAndPassword,
  signInWithPopup,
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
  }

  login(email: string, password: string) {
    return signInWithEmailAndPassword(this.auth, email, password);
  }

  loginWithGoogle() {
    return signInWithPopup(this.auth, this.googleProvider);
  }

  logout() {
    return signOut(this.auth);
  }
}

