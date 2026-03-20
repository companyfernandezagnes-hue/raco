import { createClient } from '@supabase/supabase-js';
import { EmailDraft } from '../types';

// These should be in .env but for the sake of the integration we'll use placeholders
// that the user can replace or we can provide via environment variables.
const SUPABASE_URL = import.meta.env.VITE_SUPABASE_URL || "";
const SUPABASE_KEY = import.meta.env.VITE_SUPABASE_ANON_KEY || "";

const supabase = (SUPABASE_URL && SUPABASE_KEY) ? createClient(SUPABASE_URL, SUPABASE_KEY) : null;

export async function fetchNewEmails(): Promise<EmailDraft[]> {
  if (!supabase) return [];
  
  const { data, error } = await supabase
    .from('inbox_general')
    .select('*')
    .eq('parsed', false)
    .order('created_at', { ascending: false });

  if (error) {
    console.error("Error fetching emails:", error);
    return [];
  }

  return (data || []).map(d => ({
    id: d.id,
    from: d.remitente,
    subject: d.asunto,
    date: d.created_at.slice(0, 10),
    fileBase64: d.archivo_base64
  }));
}

export async function markEmailAsParsed(id: string) {
  if (!supabase) return;
  await supabase.from('inbox_general').update({ parsed: true }).eq('id', id);
}

export async function getLatestTelegramTicket() {
  if (!supabase) return null;
  
  const { data, error } = await supabase
    .from('inbox_general')
    .select('*')
    .ilike('remitente', '📸%')
    .order('created_at', { ascending: false })
    .limit(1);

  if (error || !data?.length) return null;
  return data[0];
}
