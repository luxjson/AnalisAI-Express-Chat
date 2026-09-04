window.addEventListener('scroll', () => {
        let current = "";
        const sections = document.querySelectorAll('section[id]');
        const navLinks = document.querySelectorAll('.side-link');

        sections.forEach(section => {
            const sectionTop = section.offsetTop;
            const sectionHeight = section.clientHeight;
            if (pageYOffset >= (sectionTop - 200)) {
                current = section.getAttribute('id');
            }
        });

        navLinks.forEach(link => {
            link.classList.remove('active');
            if (link.getAttribute('href') === `#${current}`) {
                link.classList.add('active');
            }
        });
    });

    function openModal() {
        document.getElementById('infoModal').style.display = 'flex';
    }

    function closeModal() {
        document.getElementById('infoModal').style.display = 'none';
    }

    window.onclick = function(event) {
        const modal = document.getElementById('infoModal');
        if (event.target == modal) {
            closeModal();
        }
    }
if (!window.__analisaiFetchSecured) {
  window.__analisaiFetchSecured = true;
  window.ANALISAI_CSRF = document.querySelector('meta[name="csrf-token"]')?.content || '';
  const __analisaiFetch = window.fetch.bind(window);
  window.fetch = (input, init = {}) => {
    const method = String(init.method || (typeof input !== 'string' && input?.method) || 'GET').toUpperCase();
    if (['POST','PUT','PATCH','DELETE'].includes(method)) {
      const headers = new Headers(init.headers || {});
      if (!headers.has('X-CSRF-Token') && window.ANALISAI_CSRF) headers.set('X-CSRF-Token', window.ANALISAI_CSRF);
      init = { ...init, headers };
    }
    return __analisaiFetch(input, init);
  };
}

window.escapeHtml = window.escapeHtml || function(value) {
  return String(value ?? '').replace(/[&<>"']/g, ch => ({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[ch]));
};
