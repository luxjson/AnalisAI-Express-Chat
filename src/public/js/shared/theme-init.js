(function () {
  document.documentElement.dataset.theme = "dark";
  try {
    localStorage.removeItem("analisai-theme-v2");
  } catch (_) {}
})();
