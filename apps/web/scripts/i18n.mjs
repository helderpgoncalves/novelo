// Compila messages/*.json para src/paraglide com as mesmas opções do plugin do Vite.
import { compile } from '@inlang/paraglide-js';
import options from '../paraglide.options.mjs';

await compile(options);
