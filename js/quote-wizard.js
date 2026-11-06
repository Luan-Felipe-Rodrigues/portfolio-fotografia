/*
 * quote-wizard.js
 *
 * Modal multi-step disparado por [data-open-quote-wizard] em qualquer
 * página. Standalone: não colide com main.js nem client-portal.js.
 *
 * 4 steps:
 *   S1  tipo de ensaio (uma escolha)
 *   S2  data + flexibilidade + local + duração
 *   S3  estilos (cards multi, com descrição amigável) + referências
 *   S4  contato + observações + LGPD + resumo
 *
 * Pré-seleção contextual por tipo (mapa no Spec).
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

  const PRIVACY_URL = LANG === 'en' ? '/en/privacy.html' : LANG === 'es' ? '/es/privacidad.html' : '/privacidade.html';

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
      empty: 'a definir',
      recommendedBadge: 'sugestão',
      s1: {
        title: 'O que você quer fotografar?',
        hint: 'Escolhe o que mais tem a ver. Dá pra detalhar melhor nos próximos passos.'
      },
      s2: {
        title: 'Quando e onde?',
        hint: 'Se ainda não decidiu, tudo bem. Marca "sou flexível" e a gente combina.',
        date: 'Data preferida',
        dateOptional: 'opcional',
        flexible: 'Sou flexível',
        location: 'Local ou cidade',
        locationHint: 'Ex.: São Paulo, Ilhabela, estúdio…',
        duration: 'Duração estimada (horas)'
      },
      s3: {
        title: 'Como você imagina?',
        hint: 'Marca o que combina. As em destaque foram meu palpite pra você.',
        stylesLabel: 'Estilos',
        refs: 'Referências',
        refsHint: 'Cola links de Pinterest, Instagram, ou escreve o que te inspirou.'
      },
      s4: {
        title: 'Deixa eu te retornar',
        hint: 'Te retorno logo logo.',
        name: 'Seu nome',
        email: 'E-mail',
        whatsapp: 'WhatsApp',
        whatsappOptional: 'opcional',
        extra: 'Alguma observação?',
        extraOptional: 'opcional',
        summaryTitle: 'Resumo',
        consentLabel: 'Concordo em compartilhar meus dados para receber a proposta. ',
        consentLink: 'Ver política de privacidade',
        finishTitle: 'Recebi seu pedido, obrigado!',
        finishBody: 'Vou olhar com carinho e te retorno logo. Se preferir falar agora, me chama no WhatsApp: ',
        finishClose: 'Fechar'
      },
      errors: {
        network: 'Não consegui enviar agora. Tenta de novo em instantes.',
        rate: 'Muita coisa acontecendo. Aguarda um pouquinho e tenta de novo.'
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
      empty: 'to be defined',
      recommendedBadge: 'suggestion',
      s1: { title: 'What would you like to photograph?', hint: 'Pick the closest option. You can detail everything in the next steps.' },
      s2: {
        title: 'When and where?',
        hint: "Haven't decided yet? All good. Just mark \"I'm flexible\" and we can figure it out together.",
        date: 'Preferred date', dateOptional: 'optional', flexible: "I'm flexible",
        location: 'Location or city', locationHint: 'e.g. São Paulo, Ilhabela, studio…',
        duration: 'Estimated duration (hours)'
      },
      s3: {
        title: 'How do you picture it?',
        hint: 'Toggle what fits. The highlighted ones are my guess for your session.',
        stylesLabel: 'Styles', refs: 'References', refsHint: 'Drop Pinterest or Instagram links, or write what inspired you.'
      },
      s4: {
        title: 'Let me get back to you',
        hint: "I'll reply soon.",
        name: 'Your name', email: 'Email', whatsapp: 'WhatsApp', whatsappOptional: 'optional',
        extra: 'Anything else?', extraOptional: 'optional',
        summaryTitle: 'Summary',
        consentLabel: 'I agree to share my data to receive the proposal. ',
        consentLink: 'See privacy policy',
        finishTitle: "Got it, thank you!",
        finishBody: "I'll go through it and reply soon. If you'd rather talk now, message me on WhatsApp: ",
        finishClose: 'Close'
      },
      errors: { network: "Couldn't send now. Please try again in a bit.", rate: 'Too many requests right now. Give it a moment and try again.' }
    },
    es: {
      progress: (n) => `Paso ${n} de 4`,
      close: 'Cerrar',
      back: 'Volver',
      next: 'Continuar',
      submit: 'Enviar solicitud',
      skip: 'Prefiero escribir por email',
      required: 'Obligatorio',
      empty: 'a definir',
      recommendedBadge: 'sugerencia',
      s1: { title: '¿Qué te gustaría fotografiar?', hint: 'Elige lo que más te encaja. Podés detallar todo en los próximos pasos.' },
      s2: {
        title: '¿Cuándo y dónde?',
        hint: 'Si aún no decidiste, no te preocupes. Marca "soy flexible" y lo vemos juntos.',
        date: 'Fecha preferida', dateOptional: 'opcional', flexible: 'Soy flexible',
        location: 'Lugar o ciudad', locationHint: 'Ej.: São Paulo, Ilhabela, estudio…',
        duration: 'Duración estimada (horas)'
      },
      s3: {
        title: '¿Cómo lo imaginas?',
        hint: 'Marca lo que combina. Los destacados son mi sugerencia para vos.',
        stylesLabel: 'Estilos', refs: 'Referencias', refsHint: 'Pega links de Pinterest, Instagram o cuenta qué te inspiró.'
      },
      s4: {
        title: 'Déjame responderte',
        hint: 'Te respondo pronto.',
        name: 'Tu nombre', email: 'Email', whatsapp: 'WhatsApp', whatsappOptional: 'opcional',
        extra: '¿Algo más?', extraOptional: 'opcional',
        summaryTitle: 'Resumen',
        consentLabel: 'Acepto compartir mis datos para recibir la propuesta. ',
        consentLink: 'Ver política de privacidad',
        finishTitle: '¡Recibí tu solicitud, gracias!',
        finishBody: 'La miro con calma y te respondo pronto. Si prefieres hablar ahora, escríbeme por WhatsApp: ',
        finishClose: 'Cerrar'
      },
      errors: { network: 'No pude enviar ahora. Intenta de nuevo en unos instantes.', rate: 'Demasiadas solicitudes ahora. Espera un momento y vuelve a intentar.' }
    }
  };
  const T = I18N[LANG];

  // ---- Config por tipo (mapa no Spec) ----------------------------------
  const TYPES = [
    {
      id: 'prewedding',
      title: { pt: 'Pre-Wedding', en: 'Pre-Wedding', es: 'Pre-Wedding' },
      desc: {
        pt: 'Ensaio afetivo antes do casamento, geralmente ao ar livre.',
        en: 'Engagement session, usually outdoors.',
        es: 'Sesión de compromiso, generalmente al aire libre.'
      },
      duration: 4,
      styles: ['candid', 'romântico', 'natural'],
      allStyles: [
        'candid', 'romântico', 'íntimo', 'natural', 'cinematográfico',
        'ao ar livre', 'golden hour', 'delicado', 'documental',
        'preto e branco', 'colorido'
      ]
    },
    {
      id: 'autoral',
      title: { pt: 'Autoral', en: 'Personal', es: 'Autoral' },
      desc: {
        pt: 'Ensaio artístico ou retrato conceitual.',
        en: 'Artistic or conceptual portrait session.',
        es: 'Sesión artística o retrato conceptual.'
      },
      duration: 2,
      styles: ['retrato', 'minimalista', 'conceitual'],
      allStyles: [
        'retrato', 'minimalista', 'conceitual', 'editorial', 'estúdio',
        'preto e branco', 'colorido', 'dramático', 'delicado', 'ao ar livre'
      ]
    },
    {
      id: 'eventos',
      title: { pt: 'Eventos', en: 'Events', es: 'Eventos' },
      desc: {
        pt: 'Corporativo, casamento, festa. Cobertura completa.',
        en: 'Corporate, wedding, party. Full coverage.',
        es: 'Corporativo, boda, fiesta. Cobertura completa.'
      },
      duration: 6,
      styles: ['candid', 'alegre', 'documental'],
      allStyles: [
        'candid', 'alegre', 'documental', 'posado', 'elegante',
        'fotojornalismo', 'preto e branco', 'colorido', 'golden hour'
      ]
    },
    {
      id: 'lugares',
      title: { pt: 'Lugares', en: 'Places', es: 'Lugares' },
      desc: {
        pt: 'Viagem, paisagem, arquitetura, para você ou marca.',
        en: 'Travel, landscape, architecture, for you or a brand.',
        es: 'Viaje, paisaje, arquitectura, para ti o marca.'
      },
      duration: null,
      styles: ['paisagem', 'arquitetura', 'golden hour'],
      allStyles: [
        'paisagem', 'arquitetura', 'natureza', 'urbano', 'golden hour',
        'noturno', 'aéreo', 'preto e branco', 'documental'
      ]
    },
    {
      id: 'outros',
      title: { pt: 'Outros', en: 'Other', es: 'Otros' },
      desc: {
        pt: 'Me conta no próximo passo o que você tem em mente.',
        en: 'Tell me in the next step what you have in mind.',
        es: 'Cuéntame en el próximo paso qué tienes en mente.'
      },
      duration: null,
      styles: [],
      allStyles: ['livre']
    }
  ];

  const TYPE_BY_ID = new Map(TYPES.map((t) => [t.id, t]));

  // ---- Descrições amigáveis dos estilos (S3) ---------------------------
  const STYLE_META = {
    'cinematográfico': {
      label: { pt: 'Cinematográfico', en: 'Cinematic', es: 'Cinematográfico' },
      hint:  { pt: 'Cara de cena de filme, luz trabalhada.', en: 'Movie-scene feel, worked light.', es: 'Parece escena de película.' }
    },
    'candid': {
      label: { pt: 'Espontâneo', en: 'Candid', es: 'Espontáneo' },
      hint:  { pt: 'Momento pego no ar, sem pose.', en: 'Caught in the moment, unposed.', es: 'Momento capturado, sin pose.' }
    },
    'natural': {
      label: { pt: 'Natural', en: 'Natural', es: 'Natural' },
      hint:  { pt: 'Luz do dia, cores da hora, nada forçado.', en: 'Daylight, real colors, nothing forced.', es: 'Luz del día, colores reales.' }
    },
    'romântico': {
      label: { pt: 'Romântico', en: 'Romantic', es: 'Romántico' },
      hint:  { pt: 'Foco no afeto entre vocês.', en: 'Focused on the affection between you.', es: 'Enfocado en el afecto entre ustedes.' }
    },
    'íntimo': {
      label: { pt: 'Íntimo', en: 'Intimate', es: 'Íntimo' },
      hint:  { pt: 'Perto de vocês, gestos e olhares.', en: 'Close-up, gestures and glances.', es: 'Cerca, gestos y miradas.' }
    },
    'documental': {
      label: { pt: 'Documental', en: 'Documentary', es: 'Documental' },
      hint:  { pt: 'Como se eu tivesse acompanhando o dia.', en: 'Like I was tagging along.', es: 'Como si acompañara el día.' }
    },
    'conceitual': {
      label: { pt: 'Conceitual', en: 'Conceptual', es: 'Conceptual' },
      hint:  { pt: 'Uma foto com ideia por trás, mais artística.', en: 'Idea-driven, more artistic.', es: 'Con idea detrás, más artística.' }
    },
    'minimalista': {
      label: { pt: 'Minimalista', en: 'Minimal', es: 'Minimalista' },
      hint:  { pt: 'Poucos elementos, foco no essencial.', en: 'Few elements, focus on essence.', es: 'Pocos elementos, foco en lo esencial.' }
    },
    'retrato': {
      label: { pt: 'Retrato', en: 'Portrait', es: 'Retrato' },
      hint:  { pt: 'Foco em você, na sua expressão.', en: 'Focus on you and your expression.', es: 'Enfocado en ti y tu expresión.' }
    },
    'preto e branco': {
      label: { pt: 'Preto e branco', en: 'Black and white', es: 'Blanco y negro' },
      hint:  { pt: 'Sem cor, mais atemporal.', en: 'No color, more timeless.', es: 'Sin color, más atemporal.' }
    },
    'colorido': {
      label: { pt: 'Colorido', en: 'Colorful', es: 'Colorido' },
      hint:  { pt: 'Cores vibrantes e vivas.', en: 'Vibrant, alive colors.', es: 'Colores vibrantes y vivos.' }
    },
    'delicado': {
      label: { pt: 'Delicado', en: 'Soft', es: 'Delicado' },
      hint:  { pt: 'Cores suaves, luz macia.', en: 'Soft light, gentle colors.', es: 'Colores suaves, luz suave.' }
    },
    'dramático': {
      label: { pt: 'Dramático', en: 'Dramatic', es: 'Dramático' },
      hint:  { pt: 'Contrastes fortes, sombras marcantes.', en: 'Strong contrast, deep shadows.', es: 'Contrastes fuertes, sombras marcadas.' }
    },
    'alegre': {
      label: { pt: 'Alegre', en: 'Joyful', es: 'Alegre' },
      hint:  { pt: 'Sorrisos, energia, gente rindo.', en: 'Smiles, energy, laughter.', es: 'Sonrisas, energía, gente riendo.' }
    },
    'elegante': {
      label: { pt: 'Elegante', en: 'Elegant', es: 'Elegante' },
      hint:  { pt: 'Clássico, atemporal, sofisticado.', en: 'Classic, timeless, refined.', es: 'Clásico, atemporal, sofisticado.' }
    },
    'editorial': {
      label: { pt: 'Editorial', en: 'Editorial', es: 'Editorial' },
      hint:  { pt: 'Cara de revista, produção mais elaborada.', en: 'Magazine feel, more produced.', es: 'Estilo revista, más producido.' }
    },
    'fotojornalismo': {
      label: { pt: 'Fotojornalismo', en: 'Photojournalism', es: 'Fotoperiodismo' },
      hint:  { pt: 'Capturo tudo como se estivesse cobrindo uma matéria.', en: 'Full news-coverage feel.', es: 'Cobertura estilo periodístico.' }
    },
    'posado': {
      label: { pt: 'Posado', en: 'Posed', es: 'Posado' },
      hint:  { pt: 'Fotos preparadas, gente olhando pra câmera.', en: 'Prepared shots, camera-facing.', es: 'Fotos preparadas, mirando la cámara.' }
    },
    'ao ar livre': {
      label: { pt: 'Ao ar livre', en: 'Outdoors', es: 'Al aire libre' },
      hint:  { pt: 'Natureza, sol, verde.', en: 'Nature, sun, greenery.', es: 'Naturaleza, sol, verde.' }
    },
    'estúdio': {
      label: { pt: 'Estúdio', en: 'Studio', es: 'Estudio' },
      hint:  { pt: 'Fundo controlado, luz trabalhada.', en: 'Controlled backdrop, worked light.', es: 'Fondo controlado, luz trabajada.' }
    },
    'urbano': {
      label: { pt: 'Urbano', en: 'Urban', es: 'Urbano' },
      hint:  { pt: 'Cidade, rua, prédios.', en: 'City, street, buildings.', es: 'Ciudad, calle, edificios.' }
    },
    'golden hour': {
      label: { pt: 'Golden hour', en: 'Golden hour', es: 'Golden hour' },
      hint:  { pt: 'Luz dourada do fim da tarde.', en: 'Late-afternoon golden light.', es: 'Luz dorada del atardecer.' }
    },
    'noturno': {
      label: { pt: 'Noturno', en: 'Night', es: 'Nocturno' },
      hint:  { pt: 'À noite, luzes da cidade ou lua.', en: 'At night, city lights or moon.', es: 'De noche, luces de ciudad o luna.' }
    },
    'natureza': {
      label: { pt: 'Natureza', en: 'Nature', es: 'Naturaleza' },
      hint:  { pt: 'Verde, água, pouco elemento humano.', en: 'Green, water, little human presence.', es: 'Verde, agua, poco elemento humano.' }
    },
    'paisagem': {
      label: { pt: 'Paisagem', en: 'Landscape', es: 'Paisaje' },
      hint:  { pt: 'O lugar como personagem principal.', en: 'Location as the main character.', es: 'El lugar como protagonista.' }
    },
    'arquitetura': {
      label: { pt: 'Arquitetura', en: 'Architecture', es: 'Arquitectura' },
      hint:  { pt: 'Linhas, formas, prédios.', en: 'Lines, shapes, buildings.', es: 'Líneas, formas, edificios.' }
    },
    'aéreo': {
      label: { pt: 'Aéreo', en: 'Aerial', es: 'Aéreo' },
      hint:  { pt: 'Vista de cima, com drone.', en: 'From above, with a drone.', es: 'Desde arriba, con drone.' }
    },
    'livre': {
      label: { pt: 'Aberto a ideias', en: 'Open to ideas', es: 'Abierto a ideas' },
      hint:  { pt: 'Sem estilo pré-definido. Vou pela sua visão.', en: 'No preset style. I follow your vision.', es: 'Sin estilo predefinido.' }
    }
  };

  function styleMeta(id) {
    return STYLE_META[id] || { label: { pt: id, en: id, es: id }, hint: { pt: '', en: '', es: '' } };
  }

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

    const cards = all.map((s) => {
      const meta = styleMeta(s);
      const selected = state.styles.includes(s) ? 'selected' : '';
      const rec = recommended.has(s) ? 'recommended' : '';
      const recBadge = rec ? `<span class="qw-choice-tag">${T.recommendedBadge}</span>` : '';
      return `
        <button type="button" class="qw-choice ${selected} ${rec}" data-style="${escapeAttr(s)}" aria-pressed="${!!selected}">
          <span class="qw-choice-title">${escapeHtml(meta.label[LANG])}${recBadge}</span>
          <span class="qw-choice-desc">${escapeHtml(meta.hint[LANG])}</span>
        </button>
      `;
    }).join('');

    body.innerHTML = `
      <h3>${T.s3.title}</h3>
      <p class="qw-hint">${T.s3.hint}</p>

      <div class="qw-choices" role="group" aria-label="${T.s3.stylesLabel}">
        ${cards}
      </div>

      <div class="qw-field">
        <label class="qw-label" for="qw-refs">${T.s3.refs}</label>
        <textarea class="qw-textarea" id="qw-refs" maxlength="2000" placeholder="${T.s3.refsHint}">${escapeHtml(state.reference_notes || '')}</textarea>
      </div>
    `;
    body.querySelectorAll('.qw-choice').forEach((b) => {
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
    const stylesLabels = state.styles.map((s) => styleMeta(s).label[LANG]).join(', ');
    const summaryRows = [
      [T.s1.title.replace('?', '').trim(), type ? type.title[LANG] : T.empty],
      [T.s2.date.split(' ')[0], state.preferred_date ? formatDate(state.preferred_date) + (state.date_flexible ? ` (${T.s2.flexible.toLowerCase()})` : '') : T.empty],
      [T.s2.location.split(' ')[0], state.location || T.empty],
      [T.s2.duration.split(' ')[0], state.duration_hours ? `${state.duration_hours}h` : T.empty],
      [T.s3.stylesLabel, stylesLabels || T.empty]
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

      <input type="text" name="hp" tabindex="-1" autocomplete="off" class="qw-hp" aria-hidden="true">

      <div class="qw-summary" aria-label="${T.s4.summaryTitle}">
        <dl>
          ${summaryRows.map(([k, v]) => `<dt>${escapeHtml(k)}</dt><dd>${escapeHtml(v)}</dd>`).join('')}
        </dl>
      </div>

      <label class="qw-checkbox">
        <input type="checkbox" id="qw-consent" ${state.consent_given ? 'checked' : ''} required>
        <span>${T.s4.consentLabel}<a href="${PRIVACY_URL}" target="_blank" rel="noopener">${T.s4.consentLink}</a></span>
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
