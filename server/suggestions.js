// Förslagslådan: tar emot förbättringsförslag från appen och skickar dem
// vidare till en Discord-kanal via en webhook.

import { HttpError } from './db.js';

const WEBHOOK_PATTERN = /^https:\/\/(?:(?:canary|ptb)\.)?discord(?:app)?\.com\/api\/webhooks\/\d+\/[\w-]+$/;
const GREEN = 0x1f6f4a;

/** Returnerar adressen om den ser ut som en Discord-webhook, annars en tom sträng. */
export function parseWebhookUrl(raw) {
  const url = String(raw ?? '').trim();
  if (!url) return '';
  if (!WEBHOOK_PATTERN.test(url)) {
    console.warn('DISCORD_WEBHOOK_URL ser inte ut som en Discord-webhook. Förslagslådan är avstängd.');
    return '';
  }
  return url;
}

function clean(value, max) {
  return typeof value === 'string' ? value.trim().slice(0, max) : '';
}

/** Bygger Discord-meddelandet för ett förslag. */
export function buildSuggestionMessage(body, now = new Date()) {
  const text = clean(body?.text, 2000);
  if (!text) throw new HttpError(400, 'Skriv ett förslag först.');

  // Sammanhanget hjälper den som ska genomföra ändringen att hitta rätt ställe.
  const page = clean(body?.page, 100).replaceAll('`', '');
  const fields = [
    { name: 'Från', value: clean(body?.name, 60) || 'Anonym' },
    { name: 'Sida', value: page && `\`${page}\`` },
    { name: 'Utseende', value: clean(body?.theme, 60) },
    { name: 'Skärm', value: clean(body?.screen, 20) },
  ];

  return {
    username: 'Matcentralen',
    // Texten kommer från en användare och ska inte kunna pinga någon.
    allowed_mentions: { parse: [] },
    embeds: [
      {
        title: '💡 Nytt förslag',
        description: text,
        color: GREEN,
        fields: fields.filter((field) => field.value).map((field) => ({ ...field, inline: true })),
        timestamp: now.toISOString(),
      },
    ],
  };
}

export async function sendSuggestion(webhookUrl, body) {
  if (!webhookUrl) throw new HttpError(503, 'Förslagslådan är inte påslagen.');
  const message = buildSuggestionMessage(body);

  let response;
  try {
    response = await fetch(webhookUrl, {
      method: 'POST',
      signal: AbortSignal.timeout(15_000),
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(message),
    });
  } catch {
    throw new HttpError(502, 'Kunde inte nå Discord. Försök igen om en stund.');
  }
  if (!response.ok) {
    console.error(`Discord svarade ${response.status} när ett förslag skulle skickas.`);
    if (response.status === 401 || response.status === 404) {
      throw new HttpError(502, 'Förslagslådans Discord-koppling fungerar inte längre.');
    }
    throw new HttpError(502, 'Discord tog inte emot förslaget. Försök igen om en stund.');
  }
}
