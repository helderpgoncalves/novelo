import { describe, expect, it } from 'vitest';
import { createFakeDevice, type FakeDevice } from './fake-device';
import { labelZpl } from './port';

// O falso é a porta nos testes e em dev: pesos programados e etiquetas «impressas» registadas.
describe('dispositivo falso (balança + impressora)', () => {
  it('lê os pesos programados pela ordem, em gramas', async () => {
    const device = createFakeDevice([2_600, 2_400]);
    expect(device.fingerprint).toContain('demo');
    await expect(device.weigh()).resolves.toBe(2_600);
    await expect(device.weigh()).resolves.toBe(2_400);
  });

  it('sem peso programado a balança não lê nada (`null`, como a porta manda)', async () => {
    const device = createFakeDevice([]);
    await expect(device.weigh()).resolves.toBeNull();
  });

  it('«imprime» a etiqueta: fica registada para verificação (ZPL com o QR nativo)', async () => {
    const device = createFakeDevice([]);
    const ok = await device.printLabel({
      code: '9f6e2b1c-1111-4222-8333-444455556666',
      caption: 'Escola de São Torcato',
      zpl: labelZpl('9f6e2b1c-1111-4222-8333-444455556666', 'Escola de São Torcato'),
    });
    expect(ok).toBe(true);
    const printed = (device as FakeDevice).printed;
    expect(printed).toHaveLength(1);
    expect(printed[0]?.code).toBe('9f6e2b1c-1111-4222-8333-444455556666');
    expect(printed[0]?.zpl).toContain('^BQN');
    expect(printed[0]?.zpl).toContain('SÃO TORCATO'); // o ZPL usa maiúsculas e escapa os metacaracteres
  });

  it('o ZPL da etiqueta leva o UUID no QR (^BQN) e escapa metacaracteres do texto', () => {
    const zpl = labelZpl('ab', 'Saco ^ de ~teste \\x');
    expect(zpl).toContain('^FDQA,ab^FS');
    // ^, ~ e \ são metacaracteres ZPL: têm de chegar escapados ao texto humano (que sai em maiúsculas).
    expect(zpl).toContain('SACO \\^ DE \\~TESTE \\\\X');
    expect(zpl.startsWith('^XA')).toBe(true);
    expect(zpl.trimEnd().endsWith('^XZ')).toBe(true);
  });
});
