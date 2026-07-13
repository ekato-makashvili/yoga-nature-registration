(function () {
  'use strict';

  let currentLang = (localStorage && false) ? 'ka' : 'ka'; // ka is default; no persistence to keep it simple
  currentLang = document.documentElement.lang === 'en' ? 'en' : 'ka';

  const langToggleBtn = document.getElementById('langToggle');
  const breathLabel = document.getElementById('breathLabel');
  const form = document.getElementById('registrationForm');
  const submitBtn = document.getElementById('submitBtn');
  const formError = document.getElementById('formError');

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
    updateBreathLabel();
  }

  function updateBreathLabel() {
    const dict = I18N[currentLang];
    breathLabel.textContent = breathLabel.dataset.phase === 'exhale' ? dict.breathExhale : dict.breathInhale;
  }

  langToggleBtn.addEventListener('click', () => {
    applyLanguage(currentLang === 'ka' ? 'en' : 'ka');
  });

  // სუნთქვის ციკლის სინქრონიზაცია ტექსტთან (4წმ ჩასუნთქვა, 4წმ ამოსუნთქვა)
  // Sync the breathing cycle text (4s inhale, 4s exhale)
  breathLabel.dataset.phase = 'inhale';
  setInterval(() => {
    breathLabel.dataset.phase = breathLabel.dataset.phase === 'inhale' ? 'exhale' : 'inhale';
    updateBreathLabel();
  }, 4000);

  applyLanguage(currentLang);

  // --- ფორმის გაგზავნა / Form submission ---

  function showError(message) {
    formError.textContent = message;
    formError.classList.add('visible');
  }

  function clearError() {
    formError.textContent = '';
    formError.classList.remove('visible');
  }

  form.addEventListener('submit', async (event) => {
    event.preventDefault();
    clearError();

    const dict = I18N[currentLang];
    const fullName = form.fullName.value.trim();
    const phone = form.phone.value.trim();
    const packageId = form.packageId.value;

    if (!fullName) {
      showError(dict.errName);
      form.fullName.focus();
      return;
    }
    if (!phone) {
      showError(dict.errPhone);
      form.phone.focus();
      return;
    }
    if (!packageId) {
      showError(dict.errPackage);
      return;
    }

    submitBtn.disabled = true;
    submitBtn.textContent = dict.submitBtnLoading;

    try {
      const response = await fetch('/api/register', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ fullName, phone, packageId, language: currentLang })
      });

      const data = await response.json();

      if (!response.ok || !data.redirectUrl) {
        throw new Error(data.error || dict.errGeneric);
      }

      window.location.href = data.redirectUrl;
    } catch (err) {
      showError(err.message || dict.errGeneric);
      submitBtn.disabled = false;
      submitBtn.textContent = dict.submitBtn;
    }
  });

  // პაკეტის ვიზუალური მონიშვნა არჩევისას
  // Visually highlight the selected package card
  document.querySelectorAll('.package-card input[type=radio]').forEach((input) => {
    input.addEventListener('change', () => {
      document.querySelectorAll('.package-card').forEach((card) => card.classList.remove('selected'));
      input.closest('.package-card').classList.add('selected');
    });
  });
})();
