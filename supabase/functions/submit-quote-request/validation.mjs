export const STYLES = {"prewedding": ["candid", "romântico", "íntimo", "natural", "cinematográfico", "ao ar livre", "golden hour", "delicado", "documental", "preto e branco", "colorido"], "autoral": ["retrato", "minimalista", "conceitual", "editorial", "estúdio", "preto e branco", "colorido", "dramático", "delicado", "ao ar livre"], "eventos": ["candid", "alegre", "documental", "posado", "elegante", "fotojornalismo", "preto e branco", "colorido", "golden hour"], "lugares": ["paisagem", "arquitetura", "natureza", "urbano", "golden hour", "noturno", "aéreo", "preto e branco", "documental"], "outros": ["livre"]};
export function validateSchedule(body, now=new Date()) {
 const duration=body.duration_hours;
 if(duration!=null && (typeof duration!=='number'||!Number.isFinite(duration)||duration<0.5||duration>24||!Number.isInteger(duration*2)))return 'duration_hours';
 const date=body.preferred_date;
 if(date!=null && date!=='') {
  if(typeof date!=='string'||!/^\d{4}-\d{2}-\d{2}$/.test(date))return 'preferred_date';
  const parsed=new Date(date+'T12:00:00Z');
  const parts=new Intl.DateTimeFormat('en-CA',{timeZone:'America/Sao_Paulo',year:'numeric',month:'2-digit',day:'2-digit'}).formatToParts(now);
  const part=t=>parts.find(p=>p.type===t).value;
  const today=`${part('year')}-${part('month')}-${part('day')}`;
  if(isNaN(parsed)||parsed.toISOString().slice(0,10)!==date||date<today)return 'preferred_date';
 }
 if(body.styles!=null && (!Array.isArray(body.styles)||body.styles.length>20||body.styles.some(s=>!STYLES[body.ensaio_type]?.includes(s))))return 'styles';
 if(body.request_id!=null && !/^[0-9a-f]{8}-[0-9a-f]{4}-[1-5][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i.test(body.request_id))return 'request_id';
 return null;
}
