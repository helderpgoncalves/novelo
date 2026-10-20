// Aplica o tema guardado antes da primeira pintura (sem flash). Ficheiro externo: a CSP não permite scripts inline.
(function () {
  try {
    var stored = localStorage.getItem('novelo-theme');
    var dark = stored ? stored === 'dark' : window.matchMedia('(prefers-color-scheme: dark)').matches;
    if (dark) document.documentElement.classList.add('dark');
    if (stored) {
      var metas = document.querySelectorAll('meta[name="theme-color"]');
      for (var i = 0; i < metas.length; i++) metas[i].setAttribute('content', dark ? '#0F1815' : '#F4F1EA');
    }
  } catch (e) {}
})();
