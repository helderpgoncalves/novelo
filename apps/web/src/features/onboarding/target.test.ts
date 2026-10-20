import { beforeEach, describe, expect, it } from 'vitest';
import { boxesOverlap, computePlacement } from './placement';
import { allSteps, stepIdsFor, stepsFor } from './steps';
import {
  candidates,
  isPlausibleRect,
  isUsableTarget,
  spotlightBox,
  visibleFraction,
  visibleRect,
} from './target';

const VIEW = { width: 1280, height: 800 };

const place = (el: Element, r: { left: number; top: number; width: number; height: number }) => {
  el.getBoundingClientRect = () =>
    ({
      ...r,
      x: r.left,
      y: r.top,
      right: r.left + r.width,
      bottom: r.top + r.height,
      toJSON: () => ({}),
    }) as DOMRect;
};

/** Barra lateral: `nav` com scroll (y 64..700) e rodapé por baixo (700..800). */
function sidebar(itemTop: number) {
  document.body.innerHTML = `
    <aside><div>
      <nav style="overflow-y:auto"><ul><li><a data-tour="nav:/users" href="/users">Utilizadores</a></li></ul></nav>
      <div id="footer"><p>Desafio TexVitrus</p></div>
    </div></aside>`;
  const nav = document.querySelector('nav') as HTMLElement;
  const link = document.querySelector('a') as HTMLElement;
  place(nav, { left: 0, top: 64, width: 256, height: 636 });
  place(link, { left: 12, top: itemTop, width: 232, height: 36 });
  return { nav, link };
}

describe('visibilidade do alvo', () => {
  beforeEach(() => {
    document.body.innerHTML = '';
  });

  it('um item cortado pela lista com scroll não é um alvo (a causa do spotlight no rodapé)', () => {
    const { link } = sidebar(690); // 690..726: metade por baixo do fim da lista (700)
    expect(visibleRect(link, VIEW).bottom).toBe(700);
    expect(visibleFraction(link, VIEW)).toBeCloseTo(10 / 36, 2);
    expect(isUsableTarget(link, VIEW)).toBe(false);
  });

  it('um item totalmente dentro da lista é utilizável', () => {
    const { link } = sidebar(300);
    expect(visibleFraction(link, VIEW)).toBe(1);
    expect(isUsableTarget(link, VIEW)).toBe(true);
  });

  it('fora do viewport não é utilizável', () => {
    const { link } = sidebar(300);
    place(link, { left: 12, top: 900, width: 232, height: 36 });
    expect(isUsableTarget(link, VIEW)).toBe(false);
  });

  it('retângulos implausíveis (minúsculos ou do tamanho do ecrã) são rejeitados', () => {
    expect(isPlausibleRect({ left: 0, top: 0, right: 4, bottom: 4 }, VIEW)).toBe(false);
    expect(isPlausibleRect({ left: 0, top: 0, right: 1280, bottom: 800 }, VIEW)).toBe(false);
    expect(isPlausibleRect({ left: 0, top: 0, right: 256, bottom: 600 }, VIEW)).toBe(false);
    expect(isPlausibleRect({ left: 12, top: 300, right: 244, bottom: 336 }, VIEW)).toBe(true);
  });

  it('a caixa do spotlight fica sempre dentro do viewport', () => {
    const el = document.createElement('a');
    document.body.append(el);
    place(el, { left: 0, top: 0, width: 100, height: 40 });
    const box = spotlightBox(el, VIEW);
    expect(box.x).toBeGreaterThanOrEqual(0);
    expect(box.y).toBeGreaterThanOrEqual(0);
    place(el, { left: 1200, top: 770, width: 100, height: 40 });
    const edge = spotlightBox(el, VIEW);
    expect(edge.x + edge.width).toBeLessThanOrEqual(VIEW.width);
    expect(edge.y + edge.height).toBeLessThanOrEqual(VIEW.height);
  });

  it('os candidatos seguem a ordem dos seletores, sem repetidos e ignoram seletores inválidos', () => {
    document.body.innerHTML = '<a id="a" class="x"></a><b id="b" class="y"></b>';
    const found = candidates(['(', '.y', '.x', 'a'], document);
    expect(found.map((e) => e.id)).toEqual(['b', 'a']);
  });
});

describe('cartão junto do alvo', () => {
  it('deteta sobreposição e avisa quando o cartão tapa o alvo', () => {
    expect(
      boxesOverlap({ x: 0, y: 0, width: 10, height: 10 }, { x: 10, y: 0, width: 5, height: 5 }),
    ).toBe(false);
    expect(
      boxesOverlap({ x: 0, y: 0, width: 10, height: 10 }, { x: 5, y: 5, width: 10, height: 10 }),
    ).toBe(true);
    const narrow = { width: 420, height: 800 };
    const wide = computePlacement(
      { x: 100, y: 300, width: 200, height: 40 },
      { width: 360, height: 300 },
      narrow,
    );
    expect(typeof wide.overlaps).toBe('boolean');
    const roomy = computePlacement(
      { x: 8, y: 300, width: 240, height: 40 },
      { width: 360, height: 300 },
      VIEW,
    );
    expect(roomy.overlaps).toBe(false);
  });
});

describe('passos por papel', () => {
  it('o convidado tem a visita curta, o operador não vê as pessoas e o administrador sim', () => {
    expect(stepIdsFor('guest')).toEqual(['welcome', 'simulator', 'copilot', 'map', 'finish']);
    expect(stepIdsFor('operator')).not.toContain('users');
    expect(stepIdsFor('admin')).toContain('users');
    expect(stepIdsFor('qualquer')).toEqual(stepIdsFor('operator'));
  });

  it('todos os passos terminam em welcome/finish e os de destaque têm seletores exatos', () => {
    for (const role of ['guest', 'operator', 'admin']) {
      const steps = stepsFor(role);
      expect(steps[0]?.kind).toBe('welcome');
      expect(steps.at(-1)?.kind).toBe('finish');
    }
    for (const step of allSteps().filter((s) => s.kind === 'spot')) {
      expect(step.targets.length).toBeGreaterThan(0);
      for (const t of step.targets) {
        // nunca um seletor largo (`aside`, `nav`...) que apanhe o rodapé ou um contentor
        expect(t).toMatch(/data-tour="[^"]+"|aria-haspopup="dialog"/);
        expect(() => document.querySelector(t)).not.toThrow();
      }
    }
  });

  it('os passos que podem ficar atrás de «Mais» têm o botão como último recurso', () => {
    for (const step of allSteps().filter((s) => s.moreHint)) {
      expect(step.targets.at(-1)).toContain('aria-haspopup="dialog"');
    }
  });

  it('o passo das pessoas aponta ao item exato da navegação', () => {
    const users = allSteps().find((s) => s.id === 'users');
    expect(users?.targets[0]).toBe('aside a[data-tour="nav:/users"]');
  });
});
