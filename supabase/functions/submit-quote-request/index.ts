// Supabase Edge Function: submit-quote-request
//
// Recebe o payload do wizard modal (D12 revisada 2026-07-05, pattern
// Trivaxion). Valida schema strict + honeypot + rate limit (reusa
// portal_rate_check da migração 0010), grava em `quote_requests`, dispara
// email via Resend (opcional; se RESEND_API_KEY ausente, só grava).
//
// Body do POST:
//   {
//     ensaio_type: 'prewedding' | 'autoral' | 'eventos' | 'lugares' | 'outros',
//     preferred_date?: 'YYYY-MM-DD',
//     date_flexible?: boolean,
//     location?: string,
//     duration_hours?: number,
//     styles?: string[],
//     reference_notes?: string,
//     extra_notes?: string,
//     contact_name: string,
//     contact_email: string,
//     contact_whatsapp?: string,
//     consent_given: true,
//     wizard_language?: 'pt' | 'en' | 'es',
//     hp?: string   // honeypot: se preenchido, silenciosamente 200 sem gravar
//   }
//
// Retorno:
//   200 { id: uuid }
//   400 { error: 'validation' | 'bad_json' }
//   429 { error: 'rate_limited' }
//   500 { error: 'server_error' }
//
// Deploy:
//   supabase functions deploy submit-quote-request --no-verify-jwt

import { serve } from 'https://deno.land/std@0.203.0/http/server.ts';
import { createClient } from 'https://esm.sh/@supabase/supabase-js@2.45.0';

import { validateSchedule } from './validation.mjs';

const supabase = createClient(
  Deno.env.get('SUPABASE_URL')!,
  Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!,
  { auth: { persistSession: false } }
);

const RESEND_API_KEY = Deno.env.get('RESEND_API_KEY') || '';
const NOTIFY_TO = Deno.env.get('QUOTE_NOTIFY_TO') || 'rodfelluan@gmail.com';
const FROM_ADDRESS = Deno.env.get('QUOTE_FROM_ADDRESS') || 'Luan Rodrigues <onboarding@resend.dev>';

const ENSAIO_TYPES = new Set(['prewedding', 'autoral', 'eventos', 'lugares', 'outros']);
const LANGS = new Set(['pt', 'en', 'es']);
const EMAIL_RE = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
const RATE_WINDOW_S = 60;
const RATE_MAX = 5; // mais rígido: submissões de cotação são custosas

const CORS = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'content-type, authorization, apikey, x-client-info',
  'Access-Control-Allow-Methods': 'POST, OPTIONS'
};

function json(body: unknown, status = 200) {
  return new Response(JSON.stringify(body), {
    status,
    headers: { ...CORS, 'content-type': 'application/json' }
  });
}

function truncate(s: unknown, max: number): string | null {
  if (typeof s !== 'string') return null;
  const trimmed = s.trim();
  if (!trimmed) return null;
  return trimmed.length > max ? trimmed.slice(0, max) : trimmed;
}

async function isRateLimited(key: string): Promise<boolean> {
  try {
    const { data, error } = await supabase.rpc('portal_rate_check', {
      p_key: key,
      p_window_seconds: RATE_WINDOW_S,
      p_max_hits: RATE_MAX
    });
    if (error) throw error;
    return data === false;
  } catch (err) {
    console.error('quote rate check failed:', (err as Error).message);
    return true;
  }
}

async function sendEmails(rec: Record<string, unknown>, id: string) {
  if (!RESEND_API_KEY) {
    return 'not_configured';
  }
  const name = String(rec.contact_name);
  const email = String(rec.contact_email);
  const type = String(rec.ensaio_type);
  const humanType = ({
    prewedding: 'Pre-Wedding',
    autoral: 'Autoral',
    eventos: 'Eventos',
    lugares: 'Lugares',
    outros: 'Outro'
  } as Record<string, string>)[type] || type;

  // Confirmação pro solicitante
  const clientPayload = {
    from: FROM_ADDRESS,
    to: [email],
    subject: 'Recebi seu pedido de cotação',
    text: `Oi ${name.split(' ')[0]},\n\nRecebi seu interesse em um ensaio ${humanType}. Vou revisar com carinho e te respondo em até 48h com uma proposta.\n\nSe precisar de algo antes, me chama no WhatsApp: https://wa.me/5511998493113\n\nAbraço,\nLuan`
  };

  const lang = String(rec.wizard_language);
  if(lang==='en'){clientPayload.subject='Your photography request has been received';clientPayload.text=`Hi ${name.split(' ')[0]},\n\nYour request has been saved. I will reply within 48 hours.\n\nWhatsApp: https://wa.me/5511998493113\n\nLuan`;}
  if(lang==='es'){clientPayload.subject='He recibido tu solicitud de presupuesto';clientPayload.text=`Hola ${name.split(' ')[0]},\n\nTu solicitud se ha guardado. Te responderé en un plazo de 48 horas.\n\nWhatsApp: https://wa.me/5511998493113\n\nLuan`;}

  // Notificação interna
  const luanPayload = {
    from: FROM_ADDRESS,
    to: [NOTIFY_TO],
    subject: `Nova cotação de ${humanType}: ${name}`,
    text: [
      `Nova solicitação de cotação (id ${id})`,
      '',
      `Nome: ${name}`,
      `Email: ${email}`,
      rec.contact_whatsapp ? `WhatsApp: ${rec.contact_whatsapp}` : null,
      '',
      `Tipo: ${humanType}`,
      rec.preferred_date ? `Data preferida: ${rec.preferred_date}${rec.date_flexible ? ' (flexível)' : ''}` : null,
      rec.location ? `Local: ${rec.location}` : null,
      rec.duration_hours ? `Duração: ${rec.duration_hours}h` : null,
      Array.isArray(rec.styles) && rec.styles.length ? `Estilos: ${(rec.styles as string[]).join(', ')}` : null,
      rec.reference_notes ? `Referências: ${rec.reference_notes}` : null,
      rec.extra_notes ? `Observações: ${rec.extra_notes}` : null,
      '',
      `Admin: https://luanrodrigues.photography/admin/quote.html?id=${id}`
    ].filter(Boolean).join('\n')
  };

  const send = async (payload: Record<string, unknown>, recipient: string) => {
    const res = await fetch('https://api.resend.com/emails', {
      method: 'POST',
      headers: {
        Authorization: `Bearer ${RESEND_API_KEY}`,
        'content-type': 'application/json',
        'Idempotency-Key': `quote-${id}-${recipient}`
      },
      signal: AbortSignal.timeout(8000),
      body: JSON.stringify(payload)
    });
    if (!res.ok) throw new Error(`Email provider HTTP ${res.status}`);
  };
  const results=await Promise.allSettled([send(clientPayload,'client'), send(luanPayload,'owner')]);
  return results.every(r=>r.status==='fulfilled')?'sent':'failed';
}

serve(async (req) => {
  if (req.method === 'OPTIONS') return new Response(null, { headers: CORS });
  if (req.method !== 'POST') return json({ error: 'method_not_allowed' }, 405);

  let body: any;
  try {
    body = await req.json();
  } catch {
    return json({ error: 'bad_json' }, 400);
  }

  if (!body || typeof body !== 'object' || Array.isArray(body)) return json({error:'validation'},400);
  if (JSON.stringify(body).length>16000) return json({error:'payload_too_large'},413);

  if(body.action==='retry_email'){
    const token=req.headers.get('authorization')||'';
    const caller=createClient(Deno.env.get('SUPABASE_URL')!,Deno.env.get('SUPABASE_ANON_KEY')!,{global:{headers:{Authorization:token}},auth:{persistSession:false}});
    const {data:quote,error}=await caller.from('quote_requests').select('*').eq('id',body.id).maybeSingle();
    if(error||!quote)return json({error:'forbidden'},403);
    if(quote.email_status==='sent')return json({id:quote.id,email_status:'sent'});
    const email_status=await sendEmails(quote,quote.id).catch(()=>'failed');
    await supabase.from('quote_requests').update({email_status,email_sent_at:email_status==='sent'?new Date().toISOString():null,email_error:email_status==='failed'?'Provider request failed':null}).eq('id',quote.id);
    return json({id:quote.id,email_status});
  }

  // Honeypot: campo hp preenchido = bot. Retorna 200 pra não sinalizar.
  if (body?.hp) {
    return json({ id: '00000000-0000-0000-0000-000000000000' });
  }

  const invalid=validateSchedule(body);
  if(invalid)return json({error:'validation',field:invalid},400);

  // Validate strict shape
  const ensaio_type = body?.ensaio_type;
  const contact_name = truncate(body?.contact_name, 120);
  const contact_email = truncate(body?.contact_email, 240);
  const contact_whatsapp = truncate(body?.contact_whatsapp, 40);
  const preferred_date = typeof body?.preferred_date === 'string' && /^\d{4}-\d{2}-\d{2}$/.test(body.preferred_date) ? body.preferred_date : null;
  const date_flexible = body?.date_flexible === true;
  const location = truncate(body?.location, 240);
  const duration_hours = typeof body?.duration_hours === 'number' && body.duration_hours >= 0.5 && body.duration_hours <= 24 ? body.duration_hours : null;
  const styles = Array.isArray(body?.styles) ? body.styles.filter((s: unknown) => typeof s === 'string' && s.length && s.length < 50).slice(0, 20) : [];
  const reference_notes = truncate(body?.reference_notes, 2000);
  const extra_notes = truncate(body?.extra_notes, 2000);
  const consent_given = body?.consent_given === true;
  const wizard_language = typeof body?.wizard_language === 'string' && LANGS.has(body.wizard_language) ? body.wizard_language : 'pt';

  if (!ENSAIO_TYPES.has(ensaio_type)) return json({ error: 'validation', field: 'ensaio_type' }, 400);
  if (!contact_name) return json({ error: 'validation', field: 'contact_name' }, 400);
  if (!contact_email || !EMAIL_RE.test(contact_email)) return json({ error: 'validation', field: 'contact_email' }, 400);
  if (!consent_given) return json({ error: 'validation', field: 'consent_given' }, 400);

  const ip = (req.headers.get('x-forwarded-for') || '').split(',')[0].trim() || 'unknown';
  const user_agent = truncate(req.headers.get('user-agent'), 400);

  if (await isRateLimited(`${ip}:quote`)) {
    return json({ error: 'rate_limited' }, 429);
  }

  const record = {
    request_id: body.request_id || null,
    ensaio_type,
    contact_name,
    contact_email,
    contact_whatsapp,
    preferred_date,
    date_flexible,
    location,
    duration_hours,
    styles,
    reference_notes,
    extra_notes,
    consent_given,
    wizard_language,
    ip_address: ip,
    user_agent
  };

  const { data, error } = await supabase
    .from('quote_requests')
    .insert(record)
    .select('id')
    .single();
  if (error) {
    if(error.code==='23505' && body.request_id){
      const {data:existing}=await supabase.from('quote_requests').select('id,email_status').eq('request_id',body.request_id).eq('contact_email',contact_email).maybeSingle();
      if(existing)return json(existing);
    }
    console.error('insert quote_requests:', error.message);
    return json({ error: 'server_error' }, 500);
  }

  const email_status = await sendEmails(record, data.id).catch(()=>'failed');
  const {error:statusError}=await supabase.from('quote_requests').update({email_status,email_sent_at:email_status==='sent'?new Date().toISOString():null,email_error:email_status==='failed'?'Provider request failed; retry from admin.':null}).eq('id',data.id);
  if(statusError)console.error('email status:',statusError.message);
  return json({ id: data.id, email_status });
});
