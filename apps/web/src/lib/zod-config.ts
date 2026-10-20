import { z } from 'zod';

// A CSP não permite 'unsafe-eval': sem isto o Zod 4 tenta `Function('')` para compilar validadores, o browser
// regista uma violação da CSP na consola e o Zod volta ao modo normal. Desligar o JIT evita o erro (custo desprezível).
z.config({ jitless: true });
