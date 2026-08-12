(function () {
  'use strict';

  let currentLang = document.documentElement.lang === 'en' ? 'en' : 'ka';
  const langToggleBtn = document.getElementById('langToggle');

  function applyLanguage(lang) {
    currentLang = lang;
    document.documentElement.lang = lang;
    const dict = I18N[lang];

    document.querySelectorAll('[data-i18n]').forEach((el) => {
      const key = el.getAttribute('data-i18n');
      if (dict[key] !== undefined) {
        el.innerHTML = dict[key];
      }
    });

    langToggleBtn.textContent = dict.langToggle;
  }

  langToggleBtn.addEventListener('click', () => {
    applyLanguage(currentLang === 'ka' ? 'en' : 'ka');
  });

  applyLanguage(currentLang);
})();