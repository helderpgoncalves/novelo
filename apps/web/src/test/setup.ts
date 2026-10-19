import { overwriteGetLocale } from '@/paraglide/runtime';
import '@testing-library/jest-dom/vitest';

// Testes determinísticos: o idioma não depende do navegador (jsdom) nem do armazenamento.
overwriteGetLocale(() => 'pt-PT');
