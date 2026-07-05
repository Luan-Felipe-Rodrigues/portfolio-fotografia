import { supabase } from './supabase-client.js';
import { requireAdmin, renderShell } from './admin-shell.js';

const session = await requireAdmin();
if (!session) throw new Error('no session');
renderShell('quotes', session.user.email);

const root = document.getElementById('quote-root');
const params = new URLSearchParams(window.location.search);
const id = params.get('id');
if (!id) {
  root.innerHTML = '<p class="placeholder error">ID inválido.</p>';
  throw new Error('missing id');
}

const TYPE_LABELS = {
  prewedding: 'Pre-Wedding',
  autoral: 'Autoral',
  eventos: 'Eventos',
  lugares: 'Lugares',
  outros: 'Outros'
};

const STATUS_OPTIONS = ['nova', 'vista', 'respondida', 'ganha', 'perdida'];
const STATUS_LABELS = { nova: 'Nova', vista: 'Vista', respondida: 'Respondida', ganha: 'Ganha', perdida: 'Perdida' };

async function load() {
  const { data: quote, error } = await supabase
    .from('quote_requests')
    .select('*')
    .eq('id', id)
    .maybeSingle();
  if (error || !quote) {
    root.innerHTML = `<p class="placeholder error">Não encontrada.</p>`;
    return;
  }

  // Auto-marca como "vista" se ainda estava "nova"
  if (quote.status === 'nova') {
    await supabase.from('quote_requests').update({ status: 'vista' }).eq('id', id);
    quote.status = 'vista';
  }

  const { data: notes } = await supabase
    .from('quote_request_notes')
    .select('id, body, created_at')
    .eq('quote_id', id)
    .order('created_at', { ascending: false });

  render(quote, notes || []);
}

function render(q, notes) {
  const date = q.preferred_date ? new Date(q.preferred_date + 'T12:00:00').toLocaleDateString('pt-BR', { day: '2-digit', month: 'long', year: 'numeric' }) : 'a definir';
  const receivedAt = new Date(q.created_at).toLocaleString('pt-BR', { day: '2-digit', month: 'short', year: 'numeric', hour: '2-digit', minute: '2-digit' });
  const styles = (q.styles || []).length ? q.styles.map((s) => `<span class="tag muted">${escapeHtml(s)}</span>`).join(' ') : 'a definir';

  const mailtoSubject = encodeURIComponent(`Sobre seu pedido de ${TYPE_LABELS[q.ensaio_type] || q.ensaio_type}`);
  const mailtoBody = encodeURIComponent(`Oi ${q.contact_name.split(' ')[0]},\n\nRecebi seu pedido de cotação e quero conversar mais.\n\n[proposta]\n\nAbraço,\nLuan`);

  root.innerHTML = `
    <div class="quote-detail">
      <header class="quote-detail-head">
        <div>
          <p class="muted">Recebida em ${receivedAt}</p>
          <h1 style="font-weight:400;margin:0.25rem 0 0.5rem;">${escapeHtml(q.contact_name)}</h1>
          <p style="margin:0"><strong>${escapeHtml(TYPE_LABELS[q.ensaio_type] || q.ensaio_type)}</strong></p>
        </div>
        <div class="quote-status-wrap">
          <label class="muted" for="quote-status">Status</label>
          <select id="quote-status" class="button">
            ${STATUS_OPTIONS.map((s) => `<option value="${s}" ${s === q.status ? 'selected' : ''}>${STATUS_LABELS[s]}</option>`).join('')}
          </select>
        </div>
      </header>

      <section class="quote-block">
        <h3>Contato</h3>
        <dl class="quote-dl">
          <dt>E-mail</dt><dd><a href="mailto:${escapeHtml(q.contact_email)}?subject=${mailtoSubject}&body=${mailtoBody}">${escapeHtml(q.contact_email)}</a></dd>
          ${q.contact_whatsapp ? `<dt>WhatsApp</dt><dd><a href="https://wa.me/${escapeHtml(digitsOnly(q.contact_whatsapp))}" target="_blank" rel="noopener">${escapeHtml(q.contact_whatsapp)}</a></dd>` : ''}
          <dt>Idioma do wizard</dt><dd>${escapeHtml(q.wizard_language || 'pt')}</dd>
        </dl>
      </section>

      <section class="quote-block">
        <h3>Briefing</h3>
        <dl class="quote-dl">
          <dt>Data preferida</dt><dd>${date}${q.date_flexible ? ' (flexível)' : ''}</dd>
          <dt>Local</dt><dd>${escapeHtml(q.location || 'a definir')}</dd>
          <dt>Duração</dt><dd>${q.duration_hours ? `${q.duration_hours}h` : 'a definir'}</dd>
          <dt>Estilos</dt><dd>${styles}</dd>
          <dt>Referências</dt><dd>${q.reference_notes ? `<pre style="white-space:pre-wrap;margin:0;font-family:inherit;">${escapeHtml(q.reference_notes)}</pre>` : 'a definir'}</dd>
          <dt>Observações</dt><dd>${q.extra_notes ? `<pre style="white-space:pre-wrap;margin:0;font-family:inherit;">${escapeHtml(q.extra_notes)}</pre>` : 'a definir'}</dd>
        </dl>
      </section>

      <section class="quote-block">
        <h3>Anotações internas</h3>
        <form id="note-form" class="quote-note-form">
          <textarea id="note-body" placeholder="Adicionar anotação..." maxlength="2000" required></textarea>
          <button type="submit" class="button">Salvar anotação</button>
        </form>
        <ul id="notes-list" class="quote-notes">
          ${notes.map((n) => `<li><time>${new Date(n.created_at).toLocaleString('pt-BR')}</time><pre>${escapeHtml(n.body)}</pre><button class="link-btn" data-delete="${n.id}">Apagar</button></li>`).join('') || '<li class="muted">Sem anotações ainda.</li>'}
        </ul>
      </section>
    </div>
  `;

  document.getElementById('quote-status').addEventListener('change', async (e) => {
    const newStatus = e.target.value;
    const { error } = await supabase.from('quote_requests').update({ status: newStatus }).eq('id', q.id);
    if (error) alert('Erro ao mudar status: ' + error.message);
  });

  document.getElementById('note-form').addEventListener('submit', async (e) => {
    e.preventDefault();
    const body = document.getElementById('note-body').value.trim();
    if (!body) return;
    const { error } = await supabase.from('quote_request_notes').insert({ quote_id: q.id, body });
    if (error) { alert('Erro: ' + error.message); return; }
    document.getElementById('note-body').value = '';
    load();
  });

  document.querySelectorAll('[data-delete]').forEach((btn) => {
    btn.addEventListener('click', async () => {
      if (!confirm('Apagar anotação?')) return;
      await supabase.from('quote_request_notes').delete().eq('id', btn.dataset.delete);
      load();
    });
  });
}

function digitsOnly(s) {
  return String(s).replace(/[^\d]/g, '');
}

function escapeHtml(s) {
  return String(s ?? '').replace(/[&<>"']/g, (c) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c]));
}

await load();
