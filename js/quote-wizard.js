/*
 * quote-wizard.js — Sprint 4, D12 revisada 2026-07-05
 *
 * Modal multi-step disparado por [data-open-quote-wizard] em qualquer
 * página. Standalone: não colide com main.js nem client-portal.js.
 *
 * 4 steps:
 *   S1  tipo de ensaio (uma escolha)
 *   S2  data + flexibilidade + local + duração
 *   S3  estilos (badges multi) + referências
 *   S4  contato + observações + LGPD + resumo com faixa estimada
 *
 * Pré-seleção contextual por tipo (D12 revisada — tabela no Spec).
 * Estado persiste em sessionStorage (`lr_qw`) até enviar.
 * "Pular pra e-mail" no S1 fecha o modal e realça o mailto na página.
 */

(function () {
  if (window.LR_QUOTE_WIZARD) return;

  const ENDPOINT = 'https://junfgutjyicdrvpoyuzz.supabase.co/functions/v1/submit-quote-request';
  const STORAGE_KEY = 'lr_qw';

  const LANG = (() => {
    const p = window.location.pathname;
    if (p.startsWith('/en/')) return 'en';
    if (p.startsWith('/es/')) return 'es';
    return 'pt';
  })();

  // ---- Copy pt/en/es ----------------------------------------------------
  const I18N = {
    pt: {
      progress: (n) => `Passo ${n} de 4`,
      close: 'Fechar',
      back: 'Voltar',
      next: 'Continuar',
      submit: 'Enviar solicitação',
      skip: 'Prefiro escrever por e-mail',
      required: 'Campo obrigatório',
      s1: {
        title: 'O que você quer fotografar?',
        hint: 'Escolha o tipo mais próximo. Você pode detalhar depois.'
      },
      s2: {
        title: 'Quando e onde?',
        hint: 'Se ainda não decidiu, tudo bem — marque flexível.',
        date: 'Data preferida',
        dateOptional: 'opcional',
        flexible: 'Sou flexível',
        location: 'Local ou cidade',
        locationHint: 'Ex.: São Paulo, Ilhabela, estúdio…',
        duration: 'Duração estimada (horas)'
      },
      s3: {
        title: 'Como você imagina?',
        hint: 'Marque os estilos que combinam. Pré-seleções são só sugestão.',
        stylesLabel: 'Estilos',
        refs: 'Referências',
        refsHint: 'Links de Pinterest, Instagram ou descrição livre.'
      },
      s4: {
        title: 'Deixa eu te retornar',
        hint: 'Respondo em até 48h. Sem spam, sem lista.',
        name: 'Seu nome',
        email: 'E-mail',
        whatsapp: 'WhatsApp',
        whatsappOptional: 'opcional',
        extra: 'Alguma observação?',
        extraOptional: 'opcional',
        summaryTitle: 'Resumo',
        estimate: 'Faixa de investimento estimada',
        estimateNote: 'Estimativa; valor final depende de data, deslocamento e complexidade.',
        consentLabel: 'Concordo em compartilhar meus dados para receber a proposta. ',
        consentLink: 'Ver política de privacidade',
        finishTitle: 'Recebi seu pedido, obrigado!',
        finishBody: 'Vou revisar com atenção e te responder em até 48h. Se preferir, me chame no WhatsApp: ',
        finishClose: 'Fechar'
      },
      errors: {
        network: 'Não consegui enviar agora. Tente de novo em instantes.',
        rate: 'Muitas solicitações. Aguarde alguns instantes.'
      }
    },
    en: {
      progress: (n) => `Step ${n} of 4`,
      close: 'Close',
      back: 'Back',
      next: 'Continue',
      submit: 'Send request',
      skip: 'I prefer to write by email',
      required: 'Required',
      s1: { title: 'What would you like to photograph?', hint: 'Pick the closest type. You can detail it later.' },
      s2: {
        title: 'When and where?',
        hint: "If you haven't decided yet, that's fine — mark as flexible.",
        date: 'Preferred date', dateOptional: 'optional', flexible: "I'm flexible",
        location: 'Location or city', locationHint: 'e.g. São Paulo, Ilhabela, studio…',
        duration: 'Estimated duration (hours)'
      },
      s3: {
        title: 'How do you picture it?',
        hint: 'Toggle styles that match. Pre-selections are just suggestions.',
        stylesLabel: 'Styles', refs: 'References', refsHint: 'Pinterest, Instagram links or free description.'
      },
      s4: {
        title: 'Let me follow up',
        hint: 'I reply within 48h. No spam, no list.',
        name: 'Your name', email: 'Email', whatsapp: 'WhatsApp', whatsappOptional: 'optional',
        extra: 'Any other note?', extraOptional: 'optional',
        summaryTitle: 'Summary', estimate: 'Estimated investment range',
        estimateNote: 'Estimate; final price depends on date, travel, and complexity.',
        consentLabel: 'I agree to share my data to receive the proposal. ',
        consentLink: 'See privacy policy',
        finishTitle: "Got it, thank you!",
        finishBody: 'I will review it and reply within 48h. You can also reach me on WhatsApp: ',
        finishClose: 'Close'
      },
      errors: { network: "Couldn't send now. Please try again in a bit.", rate: 'Too many requests. Please wait a moment.' }
    },
    es: {
      progress: (n) => `Paso ${n} de 4`,
      close: 'Cerrar',
      back: 'Volver',
      next: 'Continuar',
      submit: 'Enviar solicitud',
      skip: 'Prefiero escribir por email',
      required: 'Obligatorio',
      s1: { title: '¿Qué te gustaría fotografiar?', hint: 'Elige el tipo más cercano. Puedes detallar después.' },
      s2: {
        title: '¿Cuándo y dónde?',
        hint: 'Si aún no decidiste, está bien — marca flexible.',
        date: 'Fecha preferida', dateOptional: 'opcional', flexible: 'Soy flexible',
        location: 'Lugar o ciudad', locationHint: 'Ej.: São Paulo, Ilhabela, estudio…',
        duration: 'Duración estimada (horas)'
      },
      s3: {
        title: '¿Cómo lo imaginas?',
        hint: 'Marca los estilos que combinan. Preselecciones son sugerencias.',
        stylesLabel: 'Estilos', refs: 'Referencias', refsHint: 'Pinterest, Instagram o descripción libre.'
      },
      s4: {
        title: 'Déjame responderte',
        hint: 'Respondo en hasta 48h. Sin spam, sin lista.',
        name: 'Tu nombre', email: 'Email', whatsapp: 'WhatsApp', whatsappOptional: 'opcional',
        extra: '¿Alguna observación?', extraOptional: 'opcional',
        summaryTitle: 'Resumen', estimate: 'Rango estimado de inversión',
        estimateNote: 'Estimación; el precio final depende de fecha, desplazamiento y complejidad.',
        consentLabel: 'Acepto compartir mis datos para recibir la propuesta. ',
        consentLink: 'Ver política de privacidad',
        finishTitle: '¡Recibí tu solicitud, gracias!',
        finishBody: 'La revisaré y te responderé en hasta 48h. También puedes contactarme por WhatsApp: ',
        finishClose: 'Cerrar'
      },
      errors: { network: 'No pude enviar ahora. Intenta de nuevo en unos instantes.', rate: 'Demasiadas solicitudes. Espera un momento.' }
    }
  };
  const T = I18N[LANG];

  // ---- Config por tipo (D12 revisada — Spec) ----------------------------
  const TYPES = [
    {
      id: 'prewedding',
      title: { pt: 'Pre-Wedding', en: 'Pre-Wedding', es: 'Pre-Wedding' },
      desc: {
        pt: 'Ensaio afetivo antes do casamento, ao ar livre.',
        en: 'Engagement session, outdoors.',
        es: 'Sesión de compromiso, al aire libre.'
      },
      duration: 4,
      styles: ['cinematográfico', 'candid', 'natural'],
      allStyles: ['cinematográfico', 'candid', 'natural', 'romântico', 'documental'],
      estimate: 'R$ 1.500-2.800'
    },
    {
      id: 'autoral',
      title: { pt: 'Autoral', en: 'Personal', es: 'Autoral' },
      desc: {
        pt: 'Ensaio artístico ou de retrato conceitual.',
        en: 'Artistic or conceptual portrait session.',
        es: 'Sesión artística o retrato conceptual.'
      },
      duration: 2,
      styles: ['conceitual', 'minimalista', 'retrato'],
      allStyles: ['conceitual', 'minimalista', 'retrato', 'preto e branco', 'editorial'],
      estimate: 'R$ 800-1.800'
    },
    {
      id: 'eventos',
      title: { pt: 'Eventos', en: 'Events', es: 'Eventos' },
      desc: {
        pt: 'Corporativo, casamento, festa — cobertura completa.',
        en: 'Corporate, wedding, party — full coverage.',
        es: 'Corporativo, boda, fiesta — cobertura completa.'
      },
      duration: 6,
      styles: ['fotojornalismo', 'documental'],
      allStyles: ['fotojornalismo', 'documental', 'posado', 'candid', 'preto e branco'],
      estimate: 'R$ 2.500-6.000'
    },
    {
      id: 'lugares',
      title: { pt: 'Lugares', en: 'Places', es: 'Lugares' },
      desc: {
        pt: 'Viagem, paisagem, arquitetura — para você ou marca.',
        en: 'Travel, landscape, architecture — for you or a brand.',
        es: 'Viaje, paisaje, arquitectura — para ti o marca.'
      },
      duration: null,
      styles: ['paisagem', 'arquitetura'],
      allStyles: ['paisagem', 'arquitetura', 'documental', 'preto e branco', 'aéreo'],
      estimate: 'sob consulta'
    },
    {
      id: 'outros',
      title: { pt: 'Outros', en: 'Other', es: 'Otros' },
      desc: {
        pt: 'Descreva no próximo passo o que tem em mente.',
        en: 'Describe what you have in mind in the next step.',
        es: 'Describe en el próximo paso qué tienes en mente.'
      },
      duration: null,
      styles: [],
      allStyles: ['livre'],
      estimate: 'sob consulta'
    }
  ];

  const TYPE_BY_ID = new Map(TYPES.map((t) => [t.id, t]));

  // ---- State -----------------------------------------------------------
  const initialState = {
    step: 1,
    ensaio_type: null,
    preferred_date: '',
    date_flexible: false,
    location: '',
    duration_hours: null,
    styles: [],
    reference_notes: '',
    contact_name: '',
    contact_email: '',
    contact_whatsapp: '',
    extra_notes: '',
    consent_given: false
  };

  let state = load() || { ...initialState };
  let modal = null;

  function load() {
    try {
      const raw = sessionStorage.getItem(STORAGE_KEY);
      if (!raw) return null;
      const parsed = JSON.parse(raw);
      return { ...initialState, ...parsed };
    } catch { return null; }
  }
  function save() {
    try { sessionStorage.setItem(STORAGE_KEY, JSON.stringify(state)); } catch { /* noop */ }
  }
  function reset() {
    state = { ...initialState };
    try { sessionStorage.removeItem(STORAGE_KEY); } catch { /* noop */ }
  }

  // ---- Modal management ------------------------------------------------
  function open() {
    if (modal) return;
    modal = buildModal();
    document.body.appendChild(modal);
    document.body.style.overflow = 'hidden';
    requestAnimationFrame(() => {
      modal.classList.add('open');
      const firstFocusable = modal.querySelector('.qw-close');
      firstFocusable?.focus();
    });
    document.addEventListener('keydown', onKey);
  }

  function close() {
    if (!modal) return;
    modal.classList.remove('open');
    document.removeEventListener('keydown', onKey);
    setTimeout(() => {
      if (modal && modal.parentNode) modal.parentNode.removeChild(modal);
      modal = null;
      document.body.style.overflow = '';
    }, 200);
  }

  function onKey(e) {
    if (e.key === 'Escape') close();
    if (e.key === 'Tab' && modal) trapFocus(e, modal);
  }

  function trapFocus(e, container) {
    const focusables = container.querySelectorAll(
      'button:not([disabled]), input:not([disabled]), select:not([disabled]), textarea:not([disabled]), [href], [tabindex]:not([tabindex="-1"])'
    );
    const visible = Array.from(focusables).filter((el) => el.offsetParent !== null || el.tagName === 'TEXTAREA');
    if (!visible.length) return;
    const first = visible[0];
    const last = visible[visible.length - 1];
    if (e.shiftKey && document.activeElement === first) {
      e.preventDefault(); last.focus();
    } else if (!e.shiftKey && document.activeElement === last) {
      e.preventDefault(); first.focus();
    }
  }

  // ---- Rendering -------------------------------------------------------
  function buildModal() {
    const el = document.createElement('div');
    el.className = 'qw-modal';
    el.setAttribute('role', 'dialog');
    el.setAttribute('aria-modal', 'true');
    el.setAttribute('aria-labelledby', 'qw-title');
    el.innerHTML = `
      <div class="qw-dialog">
        <div class="qw-header">
          <div class="qw-header-titles">
            <p class="qw-eyebrow" id="qw-progress-label">${T.progress(state.step)}</p>
            <h2 id="qw-title">Luan Rodrigues</h2>
          </div>
          <button type="button" class="qw-close" aria-label="${T.close}">×</button>
        </div>
        <div class="qw-progress" aria-hidden="true">
          <div class="qw-progress-step" data-i="1"></div>
          <div class="qw-progress-step" data-i="2"></div>
          <div class="qw-progress-step" data-i="3"></div>
          <div class="qw-progress-step" data-i="4"></div>
        </div>
        <div class="qw-body" id="qw-body"></div>
        <div class="qw-footer">
          <div class="qw-footer-left" id="qw-footer-left"></div>
          <div class="qw-footer-right" id="qw-footer-right"></div>
        </div>
      </div>
    `;
    el.addEventListener('click', (e) => {
      if (e.target === el) close();
    });
    el.querySelector('.qw-close').addEventListener('click', close);
    renderStep(el);
    return el;
  }

  function renderProgress(el) {
    el.querySelector('#qw-progress-label').textContent = T.progress(state.step);
    el.querySelectorAll('.qw-progress-step').forEach((s) => {
      const i = Number(s.dataset.i);
      s.classList.toggle('done', i < state.step);
      s.classList.toggle('current', i === state.step);
    });
  }

  function renderStep(el) {
    renderProgress(el);
    const body = el.querySelector('#qw-body');
    const left = el.querySelector('#qw-footer-left');
    const right = el.querySelector('#qw-footer-right');
    left.innerHTML = '';
    right.innerHTML = '';

    if (state.step === 1) renderS1(body);
    else if (state.step === 2) renderS2(body);
    else if (state.step === 3) renderS3(body);
    else if (state.step === 4) renderS4(body);
    else if (state.step === 5) renderSuccess(body);

    if (state.step === 5) {
      const doneBtn = btn(T.s4.finishClose, close, false, 'ghost');
      right.appendChild(doneBtn);
      return;
    }

    // Back / Skip
    if (state.step === 1) {
      const skip = document.createElement('button');
      skip.type = 'button';
      skip.className = 'qw-btn link';
      skip.textContent = T.skip;
      skip.addEventListener('click', onSkip);
      left.appendChild(skip);
    } else {
      left.appendChild(btn(T.back, onBack, false, 'ghost'));
    }

    // Next / Submit
    if (state.step === 4) {
      const submitBtn = btn(T.submit, onSubmit, !canProceed());
      right.appendChild(submitBtn);
    } else {
      right.appendChild(btn(T.next, onNext, !canProceed()));
    }
  }

  function btn(label, onClick, disabled = false, variant = '') {
    const b = document.createElement('button');
    b.type = 'button';
    b.className = 'qw-btn' + (variant ? ' ' + variant : '');
    b.textContent = label;
    b.disabled = !!disabled;
    b.addEventListener('click', onClick);
    return b;
  }

  // ---- Step content ----------------------------------------------------
  function renderS1(body) {
    const cards = TYPES.map((t) => {
      const selected = state.ensaio_type === t.id ? 'selected' : '';
      return `
        <button type="button" class="qw-choice ${selected}" data-type="${t.id}" aria-pressed="${!!selected}">
          <span class="qw-choice-title">${escapeHtml(t.title[LANG])}</span>
          <span class="qw-choice-desc">${escapeHtml(t.desc[LANG])}</span>
        </button>
      `;
    }).join('');

    body.innerHTML = `
      <h3>${T.s1.title}</h3>
      <p class="qw-hint">${T.s1.hint}</p>
      <div class="qw-choices" role="radiogroup" aria-label="${T.s1.title}">
        ${cards}
      </div>
    `;
    body.querySelectorAll('.qw-choice').forEach((c) => {
      c.addEventListener('click', () => {
        state.ensaio_type = c.dataset.type;
        // Recommend styles + duration on first pick (only if user hasn't customized)
        if (!state.styles.length) {
          const type = TYPE_BY_ID.get(state.ensaio_type);
          if (type) state.styles = [...type.styles];
        }
        if (state.duration_hours == null) {
          const type = TYPE_BY_ID.get(state.ensaio_type);
          if (type && type.duration != null) state.duration_hours = type.duration;
        }
        save();
        renderStep(modal);
      });
    });
  }

  function renderS2(body) {
    body.innerHTML = `
      <h3>${T.s2.title}</h3>
      <p class="qw-hint">${T.s2.hint}</p>

      <div class="qw-field">
        <label class="qw-label" for="qw-date">${T.s2.date} <span class="qw-optional">${T.s2.dateOptional}</span></label>
        <input class="qw-input" id="qw-date" type="date" value="${state.preferred_date}">
      </div>

      <label class="qw-checkbox">
        <input type="checkbox" id="qw-flex" ${state.date_flexible ? 'checked' : ''}>
        <span>${T.s2.flexible}</span>
      </label>

      <div class="qw-field" style="margin-top: 1rem;">
        <label class="qw-label" for="qw-loc">${T.s2.location}</label>
        <input class="qw-input" id="qw-loc" type="text" maxlength="240" value="${escapeAttr(state.location)}" placeholder="${T.s2.locationHint}">
      </div>

      <div class="qw-field">
        <label class="qw-label" for="qw-dur">${T.s2.duration}</label>
        <input class="qw-input" id="qw-dur" type="number" step="0.5" min="0.5" max="24" value="${state.duration_hours || ''}">
      </div>
    `;
    body.querySelector('#qw-date').addEventListener('input', (e) => { state.preferred_date = e.target.value; save(); refreshButtons(); });
    body.querySelector('#qw-flex').addEventListener('change', (e) => { state.date_flexible = e.target.checked; save(); });
    body.querySelector('#qw-loc').addEventListener('input', (e) => { state.location = e.target.value; save(); });
    body.querySelector('#qw-dur').addEventListener('input', (e) => {
      const v = parseFloat(e.target.value);
      state.duration_hours = isFinite(v) && v > 0 ? v : null;
      save();
    });
  }

  function renderS3(body) {
    const type = TYPE_BY_ID.get(state.ensaio_type);
    const recommended = new Set(type ? type.styles : []);
    const all = type ? type.allStyles : [];

    const badges = all.map((s) => {
      const selected = state.styles.includes(s) ? 'selected' : '';
      const rec = recommended.has(s) ? 'recommended' : '';
      return `<button type="button" class="qw-badge ${selected} ${rec}" data-style="${escapeAttr(s)}" aria-pressed="${!!selected}">${escapeHtml(s)}</button>`;
    }).join('');

    body.innerHTML = `
      <h3>${T.s3.title}</h3>
      <p class="qw-hint">${T.s3.hint}</p>

      <div class="qw-field">
        <label class="qw-label">${T.s3.stylesLabel}</label>
        <div class="qw-badges">${badges}</div>
      </div>

      <div class="qw-field">
        <label class="qw-label" for="qw-refs">${T.s3.refs}</label>
        <textarea class="qw-textarea" id="qw-refs" maxlength="2000" placeholder="${T.s3.refsHint}">${escapeHtml(state.reference_notes || '')}</textarea>
      </div>
    `;
    body.querySelectorAll('.qw-badge').forEach((b) => {
      b.addEventListener('click', () => {
        const s = b.dataset.style;
        const i = state.styles.indexOf(s);
        if (i >= 0) state.styles.splice(i, 1);
        else state.styles.push(s);
        save();
        renderStep(modal);
      });
    });
    body.querySelector('#qw-refs').addEventListener('input', (e) => { state.reference_notes = e.target.value; save(); });
  }

  function renderS4(body) {
    const type = TYPE_BY_ID.get(state.ensaio_type);
    const summaryRows = [
      [T.s1.title.replace('?', '').trim(), type ? type.title[LANG] : '—'],
      [T.s2.date.split(' ')[0], state.preferred_date ? formatDate(state.preferred_date) + (state.date_flexible ? ` (${T.s2.flexible.toLowerCase()})` : '') : '—'],
      [T.s2.location.split(' ')[0], state.location || '—'],
      [T.s2.duration.split(' ')[0], state.duration_hours ? `${state.duration_hours}h` : '—'],
      [T.s3.stylesLabel, state.styles.length ? state.styles.join(', ') : '—']
    ];

    body.innerHTML = `
      <h3>${T.s4.title}</h3>
      <p class="qw-hint">${T.s4.hint}</p>

      <div class="qw-field">
        <label class="qw-label" for="qw-name">${T.s4.name}</label>
        <input class="qw-input" id="qw-name" type="text" maxlength="120" required value="${escapeAttr(state.contact_name)}">
      </div>

      <div class="qw-field">
        <label class="qw-label" for="qw-email">${T.s4.email}</label>
        <input class="qw-input" id="qw-email" type="email" maxlength="240" required value="${escapeAttr(state.contact_email)}">
      </div>

      <div class="qw-field">
        <label class="qw-label" for="qw-wa">${T.s4.whatsapp} <span class="qw-optional">${T.s4.whatsappOptional}</span></label>
        <input class="qw-input" id="qw-wa" type="tel" maxlength="40" value="${escapeAttr(state.contact_whatsapp)}">
      </div>

      <div class="qw-field">
        <label class="qw-label" for="qw-extra">${T.s4.extra} <span class="qw-optional">${T.s4.extraOptional}</span></label>
        <textarea class="qw-textarea" id="qw-extra" maxlength="2000">${escapeHtml(state.extra_notes || '')}</textarea>
      </div>

      <!-- Honeypot: bot preenche, humano nunca vê -->
      <input type="text" name="hp" tabindex="-1" autocomplete="off" class="qw-hp" aria-hidden="true">

      <div class="qw-summary" aria-label="${T.s4.summaryTitle}">
        <dl>
          ${summaryRows.map(([k, v]) => `<dt>${escapeHtml(k)}</dt><dd>${escapeHtml(v)}</dd>`).join('')}
        </dl>
        <div class="qw-estimate">
          <span>${T.s4.estimate}</span>
          <div class="qw-estimate-value">${escapeHtml(type ? type.estimate : '—')}</div>
          <div class="qw-estimate-note">${T.s4.estimateNote}</div>
        </div>
      </div>

      <label class="qw-checkbox">
        <input type="checkbox" id="qw-consent" ${state.consent_given ? 'checked' : ''} required>
        <span>${T.s4.consentLabel}<a href="/privacidade.html" target="_blank" rel="noopener">${T.s4.consentLink}</a></span>
      </label>
    `;
    body.querySelector('#qw-name').addEventListener('input', (e) => { state.contact_name = e.target.value; save(); refreshButtons(); });
    body.querySelector('#qw-email').addEventListener('input', (e) => { state.contact_email = e.target.value; save(); refreshButtons(); });
    body.querySelector('#qw-wa').addEventListener('input', (e) => { state.contact_whatsapp = e.target.value; save(); });
    body.querySelector('#qw-extra').addEventListener('input', (e) => { state.extra_notes = e.target.value; save(); });
    body.querySelector('#qw-consent').addEventListener('change', (e) => { state.consent_given = e.target.checked; save(); refreshButtons(); });
  }

  function renderSuccess(body) {
    body.innerHTML = `
      <div class="qw-success">
        <h3>${T.s4.finishTitle}</h3>
        <p>${T.s4.finishBody}<a href="https://wa.me/5511998493113" target="_blank" rel="noopener">wa.me/5511998493113</a></p>
      </div>
    `;
  }

  // ---- Nav actions -----------------------------------------------------
  function canProceed() {
    if (state.step === 1) return !!state.ensaio_type;
    if (state.step === 2) return true; // todos opcionais
    if (state.step === 3) return true;
    if (state.step === 4) {
      const name = state.contact_name?.trim();
      const email = state.contact_email?.trim();
      const emailOk = email && /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email);
      return !!name && !!emailOk && state.consent_given;
    }
    return false;
  }

  function refreshButtons() {
    if (!modal) return;
    const right = modal.querySelector('#qw-footer-right');
    if (!right) return;
    const b = right.querySelector('button.qw-btn:not(.ghost)');
    if (b) b.disabled = !canProceed();
  }

  function onBack() {
    if (state.step > 1) state.step -= 1;
    save();
    renderStep(modal);
  }

  function onNext() {
    if (!canProceed()) return;
    state.step += 1;
    save();
    renderStep(modal);
  }

  function onSkip() {
    close();
    // Realça o mailto na página se existir
    const mailto = document.querySelector('a[href^="mailto:"]');
    if (mailto) {
      mailto.scrollIntoView({ behavior: 'smooth', block: 'center' });
      mailto.focus({ preventScroll: true });
    }
  }

  async function onSubmit() {
    if (!canProceed()) return;
    const btn = modal.querySelector('#qw-footer-right .qw-btn:not(.ghost)');
    if (btn) { btn.disabled = true; btn.textContent = '…'; }

    const hp = modal.querySelector('input[name="hp"]')?.value || '';

    const payload = {
      ensaio_type: state.ensaio_type,
      contact_name: state.contact_name.trim(),
      contact_email: state.contact_email.trim(),
      contact_whatsapp: state.contact_whatsapp?.trim() || null,
      preferred_date: state.preferred_date || null,
      date_flexible: !!state.date_flexible,
      location: state.location?.trim() || null,
      duration_hours: state.duration_hours || null,
      styles: state.styles || [],
      reference_notes: state.reference_notes?.trim() || null,
      extra_notes: state.extra_notes?.trim() || null,
      consent_given: true,
      wizard_language: LANG,
      hp
    };

    try {
      const res = await fetch(ENDPOINT, {
        method: 'POST',
        headers: { 'content-type': 'application/json' },
        body: JSON.stringify(payload)
      });
      if (res.status === 429) {
        showFooterError(T.errors.rate);
        if (btn) { btn.disabled = false; btn.textContent = T.submit; }
        return;
      }
      if (!res.ok) {
        showFooterError(T.errors.network);
        if (btn) { btn.disabled = false; btn.textContent = T.submit; }
        return;
      }
      reset();
      state.step = 5;
      renderStep(modal);
    } catch (err) {
      showFooterError(T.errors.network);
      if (btn) { btn.disabled = false; btn.textContent = T.submit; }
    }
  }

  // ---- Wire triggers ---------------------------------------------------
  function wireTriggers() {
    document.querySelectorAll('[data-open-quote-wizard]').forEach((el) => {
      if (el.dataset.qwWired) return;
      el.dataset.qwWired = '1';
      el.addEventListener('click', (e) => {
        e.preventDefault();
        open();
      });
    });
  }

  // ---- Utils -----------------------------------------------------------
  function formatDate(iso) {
    try {
      const d = new Date(iso + 'T12:00:00');
      const locale = LANG === 'en' ? 'en-US' : LANG === 'es' ? 'es-ES' : 'pt-BR';
      return d.toLocaleDateString(locale, { day: '2-digit', month: 'short', year: 'numeric' });
    } catch { return iso; }
  }

  function escapeHtml(s) {
    return String(s ?? '').replace(/[&<>"']/g, (c) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c]));
  }
  function escapeAttr(s) { return escapeHtml(s); }

  function showFooterError(msg) {
    if (!modal) return;
    const footer = modal.querySelector('.qw-footer');
    if (!footer) return;
    let err = footer.querySelector('.qw-footer-error');
    if (!err) {
      err = document.createElement('div');
      err.className = 'qw-footer-error';
      err.setAttribute('role', 'status');
      err.setAttribute('aria-live', 'polite');
      err.style.cssText = 'width:100%;flex-basis:100%;order:-1;color:var(--qw-danger);font-size:0.82rem;padding-bottom:0.35rem';
      footer.insertBefore(err, footer.firstChild);
    }
    err.textContent = msg;
  }

  // ---- Expose + init ----------------------------------------------------
  window.LR_QUOTE_WIZARD = { open, close, reset };
  if (document.readyState === 'loading') {
    document.addEventListener('DOMContentLoaded', wireTriggers);
  } else {
    wireTriggers();
  }
})();
