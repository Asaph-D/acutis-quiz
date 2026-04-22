import { Injectable, inject } from '@angular/core';
import { HttpClient } from '@angular/common/http';
import { Observable, catchError, map, of, shareReplay, tap } from 'rxjs';

type AelfLecture = {
  type: string;
  titre?: string | null;
  contenu?: string | null;
  ref?: string | null;
  intro_lue?: string | null;
};

type AelfMesse = {
  nom?: string | null;
  lectures?: AelfLecture[] | null;
};

type AelfMessesResponse = {
  informations?: {
    date?: string | null;
    zone?: string | null;
    ligne1?: string | null;
    ligne2?: string | null;
    ligne3?: string | null;
  } | null;
  messes?: AelfMesse[] | null;
};

export type AelfGospel = {
  date: string;
  title: string;
  ref: string;
  intro: string;
  html: string;
  sourceUrl: string;
};

@Injectable({ providedIn: 'root' })
export class AelfService {
  private readonly http = inject(HttpClient);

  private readonly inFlight = new Map<string, Observable<AelfGospel | null>>();

  getGospel$(date: string, zone: 'romain' | 'france' = 'romain'): Observable<AelfGospel | null> {
    const cacheKey = this.cacheKey(date, zone);
    const memo = this.inFlight.get(cacheKey);
    if (memo) return memo;

    const url = `https://api.aelf.org/v1/messes/${date}/${zone}`;
    const cached = this.readCache(cacheKey);

    const req$ = this.http.get<AelfMessesResponse>(url).pipe(
      map((res) => this.extractGospel(res, date, zone)),
      tap((g) => this.writeCache(cacheKey, g)),
      catchError(() => of(cached)),
      shareReplay({ bufferSize: 1, refCount: true })
    );

    this.inFlight.set(cacheKey, req$);
    return req$;
  }

  private extractGospel(res: AelfMessesResponse, date: string, zone: 'romain' | 'france'): AelfGospel | null {
    const messes = res?.messes ?? [];
    const lectures = messes[0]?.lectures ?? [];
    const ev = lectures.find((l) => (l?.type ?? '').toLowerCase() === 'evangile');
    if (!ev?.contenu) return null;
    return {
      date,
      title: String(ev.titre ?? 'Évangile du jour'),
      ref: String(ev.ref ?? ''),
      intro: String(ev.intro_lue ?? ''),
      html: String(ev.contenu ?? ''),
      sourceUrl: `https://aelf.org/${date}/${zone}/messe`
    } satisfies AelfGospel;
  }

  private cacheKey(date: string, zone: string) {
    return `aelf:gospel:${zone}:${date}`;
  }

  private readCache(key: string): AelfGospel | null {
    try {
      const raw = localStorage.getItem(key);
      if (!raw) return null;
      const parsed = JSON.parse(raw) as { savedAt?: number; gospel?: AelfGospel | null };
      // cache "journalier" = valable le même jour (clé par date), pas besoin de TTL sophistiqué
      const g = parsed?.gospel ?? null;
      if (!g || typeof g !== 'object') return null;
      if (typeof (g as any).date !== 'string') return null;
      return g;
    } catch {
      return null;
    }
  }

  private writeCache(key: string, gospel: AelfGospel | null) {
    try {
      localStorage.setItem(key, JSON.stringify({ savedAt: Date.now(), gospel }));
    } catch {
      // ignore quota / privacy mode
    }
  }
}

