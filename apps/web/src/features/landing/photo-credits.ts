import { m } from '@/paraglide/messages';

/**
 * Fonte única dos créditos mostrados na página pública «Créditos e licenças» (`/pt/creditos`, `/en/credits`): fotografias,
 * dados, tipos de letra e software. As fotografias de Guimarães são derivadas em meio-tom por `just brand-landing`; CC BY e
 * CC BY-SA exigem crédito visível e ligação à licença. Os registos completos (data, alterações) estão em
 * `public/landing/CREDITS.md`. O rodapé só liga a esta página.
 */
export type PhotoCredit = {
  readonly id: 'penha' | 'paco' | 'fabrica' | 'couros' | 'plataforma';
  readonly label: () => string;
  /** Título do ficheiro original na Wikimedia Commons. */
  readonly title: string;
  readonly author: string;
  readonly page: string;
  readonly license: string;
  readonly licenseUrl: string;
  /** Onde aparece o derivado, em texto. */
  readonly usedIn: () => string;
};

const BY = 'https://creativecommons.org/licenses/by/4.0/';
const BY_SA_4 = 'https://creativecommons.org/licenses/by-sa/4.0/';
const BY_SA_2 = 'https://creativecommons.org/licenses/by-sa/2.0/';

export const PHOTO_CREDITS: readonly PhotoCredit[] = [
  {
    id: 'penha',
    label: () => m.landing_photo_penha(),
    title: 'Costa - Penha, Guimarães',
    author: 'RaquelRosa7',
    page: 'https://commons.wikimedia.org/wiki/File:Costa_-_Penha,_Guimar%C3%A3es_-_20210501194326.jpg',
    license: 'CC BY-SA 4.0',
    licenseUrl: BY_SA_4,
    usedIn: () => m.credits_used_penha(),
  },
  {
    id: 'paco',
    label: () => m.landing_photo_paco(),
    title: 'DJI 0145.paço duques bragançaJPG',
    author: 'Luis Miguel Jorge Duarte',
    page: 'https://commons.wikimedia.org/wiki/File:DJI_0145.pa%C3%A7o_duques_bragan%C3%A7aJPG.jpg',
    license: 'CC BY-SA 4.0',
    licenseUrl: BY_SA_4,
    usedIn: () => m.credits_used_paco(),
  },
  {
    id: 'fabrica',
    label: () => m.landing_photo_fabrica(),
    title: 'Antiga fábrica têxtil na rua da Liberdade 1',
    author: 'V.B.Speranza',
    page: 'https://commons.wikimedia.org/wiki/File:Antiga_f%C3%A1brica_t%C3%AAxtil_na_rua_da_Liberdade_1.jpg',
    license: 'CC BY 4.0',
    licenseUrl: BY,
    usedIn: () => m.credits_used_fabrica(),
  },
  {
    id: 'couros',
    label: () => m.landing_photo_couros(),
    title: 'Couros zone',
    author: 'V.B.Speranza',
    page: 'https://commons.wikimedia.org/wiki/File:Couros_zone.jpg',
    license: 'CC BY-SA 4.0',
    licenseUrl: BY_SA_4,
    usedIn: () => m.credits_used_couros(),
  },
  {
    id: 'plataforma',
    label: () => m.landing_photo_plataforma(),
    title: 'Plataforma das Artes - Guimarães - Portugal (8244353917)',
    author: 'Vitor Oliveira',
    page: 'https://commons.wikimedia.org/wiki/File:Plataforma_das_Artes_-_Guimar%C3%A3es_-_Portugal_(8244353917).jpg',
    license: 'CC BY-SA 2.0',
    licenseUrl: BY_SA_2,
    usedIn: () => m.credits_used_plataforma(),
  },
];

export type DataCredit = {
  readonly id: string;
  readonly name: string;
  readonly text: () => string;
  /** Sem ligação quando não temos um URL oficial confirmado. */
  readonly url?: string;
  /** Licença, quando a fonte a declara e a usamos tal como está. */
  readonly license?: { readonly name: string; readonly url: string };
};

/** Fontes de dados (Regra Zero). O texto diz o que usamos de cada uma. */
export const DATA_CREDITS: readonly DataCredit[] = [
  {
    id: 'vitrus',
    name: 'Vitrus Ambiente',
    text: () => m.credits_data_vitrus(),
  },
  {
    id: 'ine',
    name: 'INE',
    text: () => m.credits_data_ine(),
    url: 'https://www.ine.pt/',
  },
  {
    id: 'caop',
    name: 'DGT · CAOP',
    text: () => m.credits_data_caop(),
    url: 'https://www.dgterritorio.gov.pt/cartografia/cartografia-tematica/caop',
  },
  {
    id: 'osm',
    name: 'OpenStreetMap',
    text: () => m.credits_data_osm(),
    url: 'https://www.openstreetmap.org/copyright',
    license: { name: 'ODbL 1.0', url: 'https://opendatacommons.org/licenses/odbl/1-0/' },
  },
  {
    id: 'urbact',
    name: 'URBACT',
    text: () => m.credits_data_urbact(),
    url: 'https://urbact.eu/sites/default/files/2026-01/Guimaraes_IAP_PT.pdf',
  },
];

export type FontCredit = {
  readonly name: string;
  readonly holder: string;
  readonly use: () => string;
  readonly url: string;
};

/** Tipos de letra (todos SIL OFL 1.1; ver `public/fonts/LICENSES.md`). */
export const FONT_LICENSE = { name: 'SIL OFL 1.1', url: 'https://openfontlicense.org/' } as const;
export const FONT_CREDITS: readonly FontCredit[] = [
  {
    name: 'Newsreader',
    holder: 'The Newsreader Project Authors',
    use: () => m.credits_font_newsreader(),
    url: 'https://github.com/productiontype/Newsreader',
  },
  {
    name: 'Inter',
    holder: 'The Inter Project Authors',
    use: () => m.credits_font_inter(),
    url: 'https://github.com/rsms/inter',
  },
  {
    name: 'Geist Mono',
    holder: 'The Geist Project Authors',
    use: () => m.credits_font_geist(),
    url: 'https://github.com/vercel/geist-font',
  },
];

export type SoftwareCredit = {
  readonly name: string;
  readonly license: string;
  readonly url: string;
};

/** Principais dependências de `apps/web/package.json`. */
export const WEB_SOFTWARE: readonly SoftwareCredit[] = [
  { name: 'React', license: 'MIT', url: 'https://react.dev/' },
  { name: 'TanStack Router e Query', license: 'MIT', url: 'https://tanstack.com/' },
  { name: 'Vite', license: 'MIT', url: 'https://vite.dev/' },
  { name: 'Tailwind CSS', license: 'MIT', url: 'https://tailwindcss.com/' },
  { name: 'Radix UI · shadcn/ui', license: 'MIT', url: 'https://ui.shadcn.com/' },
  { name: 'MapLibre GL JS', license: 'BSD-3-Clause', url: 'https://maplibre.org/' },
  { name: 'Apache ECharts', license: 'Apache-2.0', url: 'https://echarts.apache.org/' },
  { name: 'Lucide', license: 'ISC', url: 'https://lucide.dev/' },
  {
    name: 'Paraglide JS',
    license: 'MIT',
    url: 'https://inlang.com/m/gerre34r/library-inlang-paraglideJs',
  },
  { name: 'Zod', license: 'MIT', url: 'https://zod.dev/' },
];

/** Principais dependências de `apps/api/pyproject.toml`. */
export const API_SOFTWARE: readonly SoftwareCredit[] = [
  { name: 'FastAPI', license: 'MIT', url: 'https://fastapi.tiangolo.com/' },
  { name: 'Pydantic', license: 'MIT', url: 'https://docs.pydantic.dev/' },
  { name: 'SQLAlchemy', license: 'MIT', url: 'https://www.sqlalchemy.org/' },
  {
    name: 'Google OR-Tools',
    license: 'Apache-2.0',
    url: 'https://developers.google.com/optimization',
  },
  { name: 'WeasyPrint', license: 'BSD-3-Clause', url: 'https://weasyprint.org/' },
  { name: 'PostgreSQL', license: 'PostgreSQL License', url: 'https://www.postgresql.org/' },
];

/** Página oficial do hackathon na Taikai (o `og:url` canónico da própria página). */
export const HACKATHON_URL = 'https://taikai.network/cmguimaraes/hackathons/hack4guimaraes2035';
