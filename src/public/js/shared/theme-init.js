(function () {
  // AnalisAI usa exclusivamente o tema escuro.
  document.documentElement.dataset.theme = 'dark';
  try { localStorage.removeItem('analisai-theme-v2'); } catch (_) {}
})();
