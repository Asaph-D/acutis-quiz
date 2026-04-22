import { Injectable, inject } from '@angular/core';
import { HttpClient } from '@angular/common/http';
import { map } from 'rxjs';

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

  getGospel$(date: string, zone: 'romain' | 'france' = 'romain') {
    const url = `https://api.aelf.org/v1/messes/${date}/${zone}`;
    return this.http.get<AelfMessesResponse>(url).pipe(
      map((res) => {
        const messes = res?.messes ?? [];
        const lectures = messes[0]?.lectures ?? [];
        const ev = lectures.find((l) => (l?.type ?? '').toLowerCase() === 'evangile');
        if (!ev?.contenu) return null;
        return {
          date,
          title: String(ev.titre ?? "Évangile du jour"),
          ref: String(ev.ref ?? ''),
          intro: String(ev.intro_lue ?? ''),
          html: String(ev.contenu ?? ''),
          sourceUrl: `https://aelf.org/${date}/${zone}/messe`
        } satisfies AelfGospel;
      })
    );
  }
}

