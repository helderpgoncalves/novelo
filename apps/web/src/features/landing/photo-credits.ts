import { m } from '@/paraglide/messages';

/**
 * Créditos das fotografias de Guimarães usadas (derivadas em meio-tom por `just brand-landing`). CC BY e CC BY-SA exigem
 * crédito visível; os registos completos (título, data, página) estão em `public/landing/CREDITS.md`.
 */
export type PhotoCredit = {
  readonly id: string;
  readonly label: () => string;
  readonly author: string;
  readonly page: string;
  readonly license: string;
  readonly licenseUrl: string;
};

const BY = 'https://creativecommons.org/licenses/by/4.0/';
const BY_SA_4 = 'https://creativecommons.org/licenses/by-sa/4.0/';
const BY_SA_2 = 'https://creativecommons.org/licenses/by-sa/2.0/';

export const PHOTO_CREDITS: readonly PhotoCredit[] = [
  {
    id: 'penha',
    label: () => m.landing_photo_penha(),
    author: 'RaquelRosa7',
    page: 'https://commons.wikimedia.org/wiki/File:Costa_-_Penha,_Guimar%C3%A3es_-_20210501194326.jpg',
    license: 'CC BY-SA 4.0',
    licenseUrl: BY_SA_4,
  },
  {
    id: 'paco',
    label: () => m.landing_photo_paco(),
    author: 'Luis Miguel Jorge Duarte',
    page: 'https://commons.wikimedia.org/wiki/File:DJI_0145.pa%C3%A7o_duques_bragan%C3%A7aJPG.jpg',
    license: 'CC BY-SA 4.0',
    licenseUrl: BY_SA_4,
  },
  {
    id: 'fabrica',
    label: () => m.landing_photo_fabrica(),
    author: 'V.B.Speranza',
    page: 'https://commons.wikimedia.org/wiki/File:Antiga_f%C3%A1brica_t%C3%AAxtil_na_rua_da_Liberdade_1.jpg',
    license: 'CC BY 4.0',
    licenseUrl: BY,
  },
  {
    id: 'couros',
    label: () => m.landing_photo_couros(),
    author: 'V.B.Speranza',
    page: 'https://commons.wikimedia.org/wiki/File:Couros_zone.jpg',
    license: 'CC BY-SA 4.0',
    licenseUrl: BY_SA_4,
  },
  {
    id: 'plataforma',
    label: () => m.landing_photo_plataforma(),
    author: 'Vitor Oliveira',
    page: 'https://commons.wikimedia.org/wiki/File:Plataforma_das_Artes_-_Guimar%C3%A3es_-_Portugal_(8244353917).jpg',
    license: 'CC BY-SA 2.0',
    licenseUrl: BY_SA_2,
  },
];
