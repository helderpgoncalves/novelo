import type { Locale } from '@/lib/i18n';

/** Textos jurídicos públicos (Privacidade e Termos), em pt-PT e en. Um só sítio: a página e o documento da Google leem daqui. */
export interface LegalSection {
  id: string;
  title: string;
  paragraphs?: string[];
  items?: string[];
  /** Parágrafos finais, depois da lista. */
  after?: string[];
}

export interface LegalDoc {
  title: string;
  updated: string;
  intro: string;
  sections: LegalSection[];
}

export const CONTACT_EMAIL = 'novelo@heldergoncalves.io';

/** Frase de Uso Limitado exigida pela Google API Services User Data Policy (texto fixo, não alterar). */
export const LIMITED_USE: Record<Locale, string> = {
  'pt-PT':
    'O uso e a transferência para qualquer outra aplicação de informações recebidas das APIs da Google respeitarão a Política de Dados do Utilizador dos Serviços de API da Google, incluindo os requisitos de Uso Limitado.',
  en: "Novelo's use and transfer to any other app of information received from Google APIs will adhere to Google API Services User Data Policy, including the Limited Use requirements.",
};

export const GOOGLE_POLICY_URL =
  'https://developers.google.com/terms/api-services-user-data-policy';

const privacyPt: LegalDoc = {
  title: 'Política de Privacidade',
  updated: 'Última atualização: 20 de outubro de 2026',
  intro:
    'O Novelo é a ferramenta de decisão que desenha a rede de recolha seletiva de têxteis de Guimarães ao menor custo (Desafio 5 TexVitrus, Hack4Guimarães 2035). Esta política explica que dados pessoais tratamos, porquê, durante quanto tempo, com quem os partilhamos e como exerces os teus direitos. Pedimos o mínimo para te dar acesso.',
  sections: [
    {
      id: 'quem-somos',
      title: '1. Quem somos',
      paragraphs: [
        'Os responsáveis pelo tratamento são Hélder Gonçalves e Flávio Fernandes, a equipa do Novelo, a título individual. O serviço está em https://novelo.helder.si.',
        `Contacto para qualquer questão de privacidade: ${CONTACT_EMAIL}.`,
      ],
    },
    {
      id: 'dados-recolhidos',
      title: '2. Que dados recolhemos',
      paragraphs: [
        'Só recolhemos o que é preciso para teres conta e usares o serviço em segurança:',
      ],
      items: [
        'Conta: nome, endereço de email, idioma preferido, função na aplicação (administrador, operador ou convidado), estado de aprovação da conta, datas de criação e do último acesso, e a forma como a conta foi criada. Se escolheres uma palavra-passe, guardamos apenas um resumo criptográfico dela (nunca a palavra-passe).',
        'Dados Google, só se entrares com o Google: o teu endereço de email, o teu nome, a tua fotografia de perfil e o identificador único da tua conta Google. Pedimos apenas os âmbitos (scopes) openid, email e profile. Não acedemos ao teu Gmail, Drive, Calendário, Contactos nem a qualquer outro serviço Google.',
        'Consentimento: a data e a versão do texto que aceitaste, quando aplicável.',
        'Segurança e auditoria: endereço IP e identificação do browser (user-agent) associados a ações sensíveis (entrar, convites, aprovações, alterações de permissões), e contadores de pedidos para travar abusos e limitar o uso da IA por pessoa.',
        'Copiloto: as mensagens que escreves, os ficheiros que anexas (guardamos só o texto extraído; o ficheiro é descartado), as ações que o copiloto propõe e as que confirmas, e as notas de memória que tu próprio vês, editas e apagas.',
        'Triagem por foto: as fotografias são analisadas e apagadas. Só ficam a marca, a composição, o estado e o peso da peça, nunca dados de quem a entregou.',
        'Preferências neste dispositivo (armazenamento local do browser): tema claro ou escuro, idioma e o último email usado no formulário de entrada.',
      ],
    },
    {
      id: 'finalidades',
      title: '3. Para que usamos os dados e com que base legal (RGPD)',
      items: [
        'Criar e gerir a tua conta, autenticar-te e enviar-te os emails de acesso (link de entrada, convite, recuperação de palavra-passe). Base legal: execução do contrato de utilização, ou diligências pré-contratuais a teu pedido (art. 6.º, n.º 1, al. b).',
        'Proteger o serviço contra abusos e fraude (anti-bots, limites de pedidos, auditoria de ações sensíveis). Base legal: interesse legítimo (art. 6.º, n.º 1, al. f).',
        'Responder-te com o copiloto e guardar o teu histórico e memória para continuares as conversas. Base legal: execução do contrato e, para a memória, o teu consentimento (art. 6.º, n.º 1, al. a), que podes retirar desligando a memória.',
        'Cumprir obrigações legais, quando existam (art. 6.º, n.º 1, al. c).',
      ],
      after: [
        'Não vendemos dados, não fazemos publicidade, não criamos perfis comerciais e não tomamos decisões automatizadas com efeitos jurídicos sobre ti.',
      ],
    },
    {
      id: 'google',
      title: '4. Dados Google e Uso Limitado',
      paragraphs: [
        'Quando entras com o Google, a Google envia-nos o teu email, nome, fotografia de perfil e identificador de conta. Usamos estes dados exclusivamente para criar a tua conta e iniciar a tua sessão no Novelo, e para mostrar o teu nome e a tua fotografia na aplicação. Não os usamos para publicidade, não os vendemos, não os transferimos para terceiros (exceto os subprocessadores da secção 6, estritamente para fornecer o serviço), não os usamos para treinar modelos de IA e nenhuma pessoa os lê, salvo para segurança, apoio que nos peças ou obrigação legal.',
        LIMITED_USE['pt-PT'],
        'Podes revogar o acesso do Novelo à tua conta Google em myaccount.google.com/permissions, e pedir-nos a eliminação da conta (secção 8).',
      ],
    },
    {
      id: 'retencao',
      title: '5. Durante quanto tempo guardamos os dados',
      items: [
        'Conta e dados Google: enquanto a conta existir. Eliminamos a conta e os dados associados quando o pedires, no prazo máximo de 30 dias.',
        'Histórico do copiloto e memória: tu escolhes o prazo (30, 90 ou 365 dias) ou apagas tudo quando quiseres; o sistema pode impor um máximo.',
        'Registos de auditoria e segurança (IP, user-agent): o tempo necessário para a segurança do serviço e para demonstrar o cumprimento de pedidos, e eliminados ou anonimizados a pedido quando a lei o permita.',
        'Fotografias da triagem: apagadas depois de analisadas.',
        'Cópias de segurança da base de dados: seguem o ciclo de rotação do servidor; os dados eliminados desaparecem delas quando as cópias rodam.',
      ],
    },
    {
      id: 'subprocessadores',
      title: '6. Com quem partilhamos (subprocessadores)',
      paragraphs: [
        'Só recorremos a prestadores necessários para o serviço funcionar, ligados por contrato ao nosso tratamento:',
      ],
      items: [
        'Hetzner Online GmbH (servidor VPS na União Europeia) e Coolify (software de implementação que corre nesse servidor): alojam a aplicação e a base de dados. Os dados pessoais ficam armazenados na UE.',
        'Cloudflare, Inc.: DNS, proteção contra ataques e Cloudflare Turnstile (verificação anti-bots nos formulários de entrada e registo). O Turnstile vê o teu pedido, IP e características do browser para distinguir pessoas de robôs.',
        'Resend (Resend, Inc.): envio dos emails transacionais (link de entrada, convite, recuperação de palavra-passe). Recebe o teu endereço de email e o conteúdo do email.',
        'OpenRouter e o fornecedor do modelo de linguagem escolhido (atualmente configurado no painel de administração, por omissão openai/gpt-6-luna): processam os pedidos do copiloto, do "E se...?", da triagem por foto e dos briefings. É enviado o texto que escreves, o texto extraído dos ficheiros que anexas, as fotografias da triagem, as notas de memória, a descrição do ecrã em que estás e os resultados de ferramentas (dados da rede de recolha, que não são dados pessoais). Não enviamos a tua palavra-passe nem o teu email. O registo de uso que guardamos contém só o modelo, o custo e a duração, nunca o conteúdo. A IA propõe; só tu confirmas qualquer alteração.',
        'Google LLC: fornece o início de sessão com o Google, quando o escolhes.',
      ],
      after: [
        'Alguns destes prestadores estão nos Estados Unidos. Quando há transferência internacional, assenta nas cláusulas contratuais-tipo da Comissão Europeia e/ou no Quadro de Privacidade de Dados UE-EUA. Não partilhamos dados com mais ninguém, salvo obrigação legal.',
      ],
    },
    {
      id: 'cookies',
      title: '7. Cookies e armazenamento local',
      paragraphs: [
        'Usamos apenas cookies estritamente necessários, que não exigem consentimento: um cookie de sessão de acesso (15 minutos) e um cookie de renovação (até 30 dias se escolheres manter a sessão; caso contrário desaparece quando fechas o browser), ambos HttpOnly e seguros. Não usamos cookies de publicidade, de análise nem de rastreio, e não há ferramentas de analítica de terceiros.',
        'O armazenamento local do browser guarda apenas o tema, o idioma, o último email e pequenos estados da interface (por exemplo, a visita guiada já vista). Podes apagá-lo nas definições do browser.',
      ],
    },
    {
      id: 'direitos',
      title: '8. Os teus direitos e como os exercer',
      paragraphs: [
        'Podes pedir o acesso, a retificação, o apagamento, a limitação, a portabilidade e a oposição ao tratamento dos teus dados, e retirar o consentimento a qualquer momento, sem afetar o que foi feito antes. Muitas destas ações fazem-se na própria aplicação (conta e privacidade do copiloto, onde podes exportar e apagar o teu histórico e memória).',
        `Para o resto, escreve para ${CONTACT_EMAIL}; respondemos no prazo de um mês. Tens ainda o direito de apresentar reclamação à Comissão Nacional de Proteção de Dados (CNPD), www.cnpd.pt.`,
      ],
    },
    {
      id: 'menores',
      title: '9. Menores',
      paragraphs: [
        'O Novelo é uma ferramenta profissional e não se destina a menores de 16 anos. Não recolhemos conscientemente dados de menores; se tomares conhecimento de que um menor nos deu dados, avisa-nos e eliminamo-los.',
      ],
    },
    {
      id: 'seguranca',
      title: '10. Segurança',
      paragraphs: [
        'Ligação cifrada (HTTPS), palavras-passe só em resumo criptográfico, cookies HttpOnly, limites de pedidos, verificação anti-bots, aprovação de contas por um administrador e registo de auditoria. Nenhum sistema é infalível; se houver uma violação de dados pessoais que te afete, notificamos-te e a CNPD nos termos da lei.',
      ],
    },
    {
      id: 'alteracoes',
      title: '11. Alterações a esta política',
      paragraphs: [
        'Se mudarmos esta política de forma relevante, atualizamos a data no topo e avisamos-te na aplicação ou por email. A versão em vigor está sempre em https://novelo.helder.si/pt/privacy.',
      ],
    },
  ],
};

const privacyEn: LegalDoc = {
  title: 'Privacy Policy',
  updated: 'Last updated: 20 October 2026',
  intro:
    'Novelo is the decision tool that designs the cheapest separate textile collection network for Guimarães, Portugal (Challenge 5 TexVitrus, Hack4Guimarães 2035). This policy explains which personal data we process, why, for how long, who we share it with and how you can exercise your rights. We ask for the minimum needed to give you access.',
  sections: [
    {
      id: 'who-we-are',
      title: '1. Who we are',
      paragraphs: [
        'The data controllers are Hélder Gonçalves and Flávio Fernandes, the Novelo team, acting individually. The service is at https://novelo.helder.si.',
        `Contact for any privacy matter: ${CONTACT_EMAIL}.`,
      ],
    },
    {
      id: 'data-we-collect',
      title: '2. What data we collect',
      paragraphs: [
        'We only collect what is needed for you to have an account and use the service safely:',
      ],
      items: [
        'Account: name, email address, preferred language, role in the app (administrator, operator or guest), account approval status, creation and last sign-in dates, and how the account was created. If you choose a password, we store only a cryptographic hash of it (never the password itself).',
        'Google data, only if you sign in with Google: your email address, your name, your profile picture and the unique identifier of your Google account. We request only the openid, email and profile scopes. We do not access your Gmail, Drive, Calendar, Contacts or any other Google service.',
        'Consent: the date and version of the text you accepted, where applicable.',
        'Security and audit: IP address and browser identification (user agent) linked to sensitive actions (sign-in, invitations, approvals, permission changes), and request counters to stop abuse and limit AI use per person.',
        'Copilot: the messages you write, the files you attach (we keep only the extracted text; the file is discarded), the actions the copilot proposes and the ones you confirm, and memory notes that you can see, edit and delete yourself.',
        'Photo triage: photos are analysed and then deleted. Only the brand, composition, condition and weight of the item are kept, never data about who handed it in.',
        'Preferences on this device (browser local storage): light or dark theme, language and the last email used in the sign-in form.',
      ],
    },
    {
      id: 'purposes',
      title: '3. What we use the data for and the legal basis (GDPR)',
      items: [
        'Create and manage your account, authenticate you and send you access emails (sign-in link, invitation, password recovery). Legal basis: performance of the contract of use, or pre-contractual steps at your request (Art. 6(1)(b)).',
        'Protect the service against abuse and fraud (anti-bot checks, request limits, audit of sensitive actions). Legal basis: legitimate interest (Art. 6(1)(f)).',
        'Answer you with the copilot and keep your history and memory so you can continue conversations. Legal basis: performance of the contract and, for memory, your consent (Art. 6(1)(a)), which you can withdraw by turning memory off.',
        'Comply with legal obligations, where they exist (Art. 6(1)(c)).',
      ],
      after: [
        'We do not sell data, we do not advertise, we do not build commercial profiles and we do not take automated decisions with legal effects on you.',
      ],
    },
    {
      id: 'google',
      title: '4. Google user data and Limited Use',
      paragraphs: [
        'When you sign in with Google, Google sends us your email, name, profile picture and account identifier. We use this data solely to create your account and sign you in to Novelo, and to show your name and picture in the app. We do not use it for advertising, we do not sell it, we do not transfer it to third parties (other than the sub-processors in section 6, strictly to provide the service), we do not use it to train AI models and no human reads it, except for security, support you ask us for, or legal obligation.',
        LIMITED_USE.en,
        'You can revoke Novelo’s access to your Google account at myaccount.google.com/permissions, and ask us to delete your account (section 8).',
      ],
    },
    {
      id: 'retention',
      title: '5. How long we keep data',
      items: [
        'Account and Google data: for as long as the account exists. We delete the account and its data when you ask, within 30 days at most.',
        'Copilot history and memory: you choose the period (30, 90 or 365 days) or delete everything whenever you want; the system may impose a maximum.',
        'Audit and security logs (IP, user agent): as long as needed for the security of the service and to demonstrate that requests were handled, and deleted or anonymised on request where the law allows.',
        'Triage photos: deleted after analysis.',
        'Database backups: follow the server rotation cycle; deleted data disappears from them as backups rotate.',
      ],
    },
    {
      id: 'sub-processors',
      title: '6. Who we share data with (sub-processors)',
      paragraphs: [
        'We only use providers that are necessary for the service to work, bound by contract to our processing:',
      ],
      items: [
        'Hetzner Online GmbH (VPS server in the European Union) and Coolify (deployment software running on that server): host the application and the database. Personal data is stored in the EU.',
        'Cloudflare, Inc.: DNS, attack protection and Cloudflare Turnstile (anti-bot check on the sign-in and registration forms). Turnstile sees your request, IP and browser characteristics to tell people from robots.',
        'Resend (Resend, Inc.): sending of transactional emails (sign-in link, invitation, password recovery). It receives your email address and the content of the email.',
        'OpenRouter and the provider of the chosen language model (currently set in the admin panel, by default openai/gpt-6-luna): process copilot, "What if...?", photo triage and briefing requests. What is sent is the text you write, the text extracted from files you attach, triage photos, memory notes, a description of the screen you are on and tool results (data about the collection network, which is not personal data). We do not send your password or your email. The usage log we keep contains only the model, cost and duration, never the content. The AI proposes; only you confirm any change.',
        'Google LLC: provides Sign in with Google, when you choose it.',
      ],
      after: [
        'Some of these providers are in the United States. Where there is an international transfer, it relies on the European Commission’s standard contractual clauses and/or the EU-US Data Privacy Framework. We share data with no one else, except where legally required.',
      ],
    },
    {
      id: 'cookies',
      title: '7. Cookies and local storage',
      paragraphs: [
        'We only use strictly necessary cookies, which do not require consent: an access session cookie (15 minutes) and a renewal cookie (up to 30 days if you choose to stay signed in; otherwise it disappears when you close the browser), both HttpOnly and secure. We use no advertising, analytics or tracking cookies, and no third-party analytics tools.',
        'The browser’s local storage keeps only the theme, the language, the last email and small interface states (for example, that the guided tour was already seen). You can clear it in your browser settings.',
      ],
    },
    {
      id: 'rights',
      title: '8. Your rights and how to exercise them',
      paragraphs: [
        'You can request access, rectification, erasure, restriction, portability and objection to the processing of your data, and withdraw consent at any time without affecting what was done before. Many of these actions can be done in the app itself (account and copilot privacy, where you can export and delete your history and memory).',
        `For anything else, write to ${CONTACT_EMAIL}; we answer within one month. You also have the right to lodge a complaint with the Portuguese data protection authority (CNPD), www.cnpd.pt, or with your local authority.`,
      ],
    },
    {
      id: 'children',
      title: '9. Children',
      paragraphs: [
        'Novelo is a professional tool and is not intended for children under 16. We do not knowingly collect data from children; if you learn that a child has given us data, tell us and we will delete it.',
      ],
    },
    {
      id: 'security',
      title: '10. Security',
      paragraphs: [
        'Encrypted connection (HTTPS), passwords only as a cryptographic hash, HttpOnly cookies, request limits, anti-bot checks, account approval by an administrator and an audit log. No system is infallible; if a personal data breach affects you, we will notify you and the CNPD as required by law.',
      ],
    },
    {
      id: 'changes',
      title: '11. Changes to this policy',
      paragraphs: [
        'If we change this policy in a material way, we update the date at the top and let you know in the app or by email. The current version is always at https://novelo.helder.si/en/privacy.',
      ],
    },
  ],
};

const termsPt: LegalDoc = {
  title: 'Termos de Utilização',
  updated: 'Última atualização: 20 de outubro de 2026',
  intro:
    'Estes termos regem o uso do Novelo em https://novelo.helder.si. Ao criar conta, entrar ou usar o serviço, aceitas estes termos e a Política de Privacidade.',
  sections: [
    {
      id: 'servico',
      title: '1. O serviço',
      paragraphs: [
        'O Novelo ajuda a planear a rede de recolha seletiva de têxteis de Guimarães: simula cenários, compara custos e toneladas, e explica resultados em português. É um protótipo desenvolvido no Hack4Guimarães 2035 (Desafio 5 TexVitrus) por Hélder Gonçalves e Flávio Fernandes e é prestado tal como está, sem garantia de disponibilidade contínua.',
      ],
    },
    {
      id: 'conta',
      title: '2. Conta e acesso',
      items: [
        'Podes criar conta com email e palavra-passe, link por email, convite ou Google. Algumas contas ficam pendentes até um administrador as aprovar.',
        'Tens de dar dados verdadeiros, manter as credenciais seguras e avisar-nos de qualquer uso indevido da tua conta.',
        'O serviço destina-se a maiores de 16 anos. Podemos suspender ou eliminar contas que violem estes termos.',
      ],
    },
    {
      id: 'uso',
      title: '3. Uso aceitável',
      paragraphs: ['Não podes:'],
      items: [
        'tentar aceder a dados ou contas que não são teus, nem contornar limites, autenticação ou medidas anti-abuso;',
        'enviar conteúdo ilegal, malicioso ou que viole direitos de terceiros, ou fotografias que mostrem pessoas;',
        'usar o serviço para sobrecarregar a infraestrutura, fazer extração automática em massa ou revender o acesso.',
      ],
    },
    {
      id: 'ia',
      title: '4. Inteligência artificial e resultados',
      paragraphs: [
        'O copiloto e as funcionalidades de IA percebem perguntas e explicam resultados, mas não fazem contas: os números vêm do otimizador e dos dados, e um verificador rejeita números que não existam nos resultados. Mesmo assim, as respostas podem conter erros. Os cenários, custos e reduções são estimativas sobre os dados da Vitrus Ambiente e do INE e sobre pressupostos documentados; não são promessa nem aconselhamento jurídico, financeiro ou ambiental. Verifica sempre antes de decidir.',
        'A IA só propõe alterações; só tu as confirmas, com as tuas permissões.',
      ],
    },
    {
      id: 'conteudo',
      title: '5. O teu conteúdo e os dados',
      paragraphs: [
        'O que escreves e carregas continua a ser teu. Damos-nos a licença limitada necessária para o tratar e mostrar-to no serviço e para o enviar aos subprocessadores descritos na Política de Privacidade. Os dados de base (Vitrus Ambiente, INE, municípios) pertencem aos respetivos titulares e usam-se nas condições em que nos foram cedidos.',
      ],
    },
    {
      id: 'propriedade',
      title: '6. Propriedade intelectual',
      paragraphs: [
        'O Novelo, a sua marca, logótipo, design e código pertencem à equipa do Novelo, sem prejuízo das licenças de software livre de que depende. Podes usar o serviço, mas não copiar nem distribuir a marca ou o código fora do que a lei permitir.',
      ],
    },
    {
      id: 'responsabilidade',
      title: '7. Limitação de responsabilidade',
      paragraphs: [
        'Na medida permitida pela lei, não respondemos por perdas indiretas ou decisões tomadas com base nos resultados do Novelo, nem por indisponibilidades, erros ou perda de dados. Nada nestes termos exclui a responsabilidade que a lei não permita excluir.',
      ],
    },
    {
      id: 'privacidade',
      title: '8. Privacidade',
      paragraphs: [
        'O tratamento de dados pessoais está descrito na Política de Privacidade, que faz parte destes termos, incluindo o uso de dados Google e a declaração de Uso Limitado.',
      ],
    },
    {
      id: 'alteracoes',
      title: '9. Alterações, cessação e lei aplicável',
      paragraphs: [
        'Podemos alterar o serviço e estes termos; avisamos de alterações relevantes e o uso continuado depois do aviso significa aceitação. Podes deixar de usar o serviço e pedir a eliminação da conta a qualquer momento. Estes termos regem-se pela lei portuguesa e os litígios são da competência dos tribunais portugueses, sem prejuízo dos direitos imperativos dos consumidores.',
        `Contacto: ${CONTACT_EMAIL}.`,
      ],
    },
  ],
};

const termsEn: LegalDoc = {
  title: 'Terms of Use',
  updated: 'Last updated: 20 October 2026',
  intro:
    'These terms govern the use of Novelo at https://novelo.helder.si. By creating an account, signing in or using the service, you accept these terms and the Privacy Policy.',
  sections: [
    {
      id: 'service',
      title: '1. The service',
      paragraphs: [
        'Novelo helps plan the separate textile collection network of Guimarães: it simulates scenarios, compares costs and tonnes, and explains results in plain language. It is a prototype built at Hack4Guimarães 2035 (Challenge 5 TexVitrus) by Hélder Gonçalves and Flávio Fernandes and is provided as is, with no guarantee of continuous availability.',
      ],
    },
    {
      id: 'account',
      title: '2. Account and access',
      items: [
        'You can create an account with email and password, an email link, an invitation or Google. Some accounts stay pending until an administrator approves them.',
        'You must provide true information, keep your credentials safe and tell us about any misuse of your account.',
        'The service is for people aged 16 or over. We may suspend or delete accounts that breach these terms.',
      ],
    },
    {
      id: 'use',
      title: '3. Acceptable use',
      paragraphs: ['You may not:'],
      items: [
        'try to access data or accounts that are not yours, or bypass limits, authentication or anti-abuse measures;',
        'upload illegal or malicious content, content that infringes third-party rights, or photos showing people;',
        'use the service to overload the infrastructure, scrape it in bulk or resell access.',
      ],
    },
    {
      id: 'ai',
      title: '4. Artificial intelligence and results',
      paragraphs: [
        'The copilot and AI features understand questions and explain results, but they do not do the maths: numbers come from the optimiser and the data, and a checker rejects numbers that are not in the results. Even so, answers may contain errors. Scenarios, costs and reductions are estimates built on data from Vitrus Ambiente and INE and on documented assumptions; they are not a promise or legal, financial or environmental advice. Always check before deciding.',
        'The AI only proposes changes; only you confirm them, with your own permissions.',
      ],
    },
    {
      id: 'content',
      title: '5. Your content and data',
      paragraphs: [
        'What you write and upload remains yours. You grant us the limited licence needed to process it and show it to you in the service and to send it to the sub-processors described in the Privacy Policy. Base data (Vitrus Ambiente, INE, municipalities) belongs to its owners and is used under the terms on which it was given to us.',
      ],
    },
    {
      id: 'ip',
      title: '6. Intellectual property',
      paragraphs: [
        'Novelo, its brand, logo, design and code belong to the Novelo team, without prejudice to the open-source licences it depends on. You may use the service, but not copy or distribute the brand or the code beyond what the law allows.',
      ],
    },
    {
      id: 'liability',
      title: '7. Limitation of liability',
      paragraphs: [
        'To the extent permitted by law, we are not liable for indirect losses or decisions taken based on Novelo results, nor for downtime, errors or data loss. Nothing in these terms excludes liability that the law does not allow to be excluded.',
      ],
    },
    {
      id: 'privacy',
      title: '8. Privacy',
      paragraphs: [
        'The processing of personal data is described in the Privacy Policy, which is part of these terms, including the use of Google user data and the Limited Use statement.',
      ],
    },
    {
      id: 'changes',
      title: '9. Changes, termination and governing law',
      paragraphs: [
        'We may change the service and these terms; we will notify you of material changes and continued use after notice means acceptance. You may stop using the service and ask for your account to be deleted at any time. These terms are governed by Portuguese law and disputes fall under the Portuguese courts, without prejudice to mandatory consumer rights.',
        `Contact: ${CONTACT_EMAIL}.`,
      ],
    },
  ],
};

export const PRIVACY: Record<Locale, LegalDoc> = { 'pt-PT': privacyPt, en: privacyEn };
export const TERMS: Record<Locale, LegalDoc> = { 'pt-PT': termsPt, en: termsEn };
