// Semantic copy checks via the Anthropic API. Each page's title, description,
// schema.org data and visible copy are sent to Claude to flag contradictions
// (white vs yellow gold, automatic vs quartz, strap vs bracelet, ...) and
// terminology inconsistencies. The API key stays server-side; if it isn't
// configured these checks are skipped and every other check still runs.
import Anthropic from '@anthropic-ai/sdk';
import { config } from './config.js';

let client = null;

export function semanticEnabled() {
  return Boolean(config.anthropicApiKey || process.env.ANTHROPIC_API_KEY);
}

function getClient() {
  if (!client) {
    client = new Anthropic({ apiKey: config.anthropicApiKey || undefined });
  }
  return client;
}

const SCHEMA = {
  type: 'object',
  additionalProperties: false,
  required: ['issues'],
  properties: {
    issues: {
      type: 'array',
      items: {
        type: 'object',
        additionalProperties: false,
        required: ['type', 'severity', 'message', 'evidence'],
        properties: {
          type: { type: 'string', enum: ['contradiction', 'terminology', 'other'] },
          severity: { type: 'string', enum: ['high', 'medium', 'low'] },
          message: { type: 'string' },
          evidence: { type: 'string' },
        },
      },
    },
  },
};

const SYSTEM_PROMPT = `You are a QA reviewer for luxury jewellery and watch retail websites (Goldsmiths, Mappin & Webb, Watches of Switzerland).

You are given one product/content page as JSON: its title, meta description, h1 headings, schema.org structured data, and visible copy. Find genuine quality problems where the page contradicts itself or uses inconsistent terminology, for example:
- material contradictions: title says white gold but description says yellow gold; steel vs titanium; rose gold vs yellow gold
- movement contradictions: automatic vs quartz vs manual
- strap vs bracelet described inconsistently
- dial/case colour or size stated differently in different fields
- brand, model or collection name mismatches between title, description, structured data and copy
- prices or discounts that disagree between structured data and visible copy
- placeholder or lorem-ipsum copy, obviously truncated sentences

Report only real, specific issues you can quote evidence for. Cosmetic style differences (e.g. "watch strap" vs "strap") are not issues unless they change meaning. If the page is consistent, return an empty issues array.

severity: high = factual contradiction a customer would notice; medium = likely error or confusing inconsistency; low = minor terminology inconsistency.`;

/**
 * @returns array of issue objects {type, severity, message, detail}
 */
export async function analyzePage({ url, title, metaDescription, h1s, jsonLd, visibleText }) {
  if (!semanticEnabled()) return [];
  try {
    const payload = { url, title, metaDescription, h1s, schemaOrg: jsonLd, visibleText };
    const resp = await getClient().beta.messages.create({
      model: config.semanticModel,
      max_tokens: 2048,
      betas: ['server-side-fallback-2026-07-01'],
      fallbacks: 'default',
      output_config: {
        effort: config.semanticEffort,
        format: { type: 'json_schema', schema: SCHEMA },
      },
      system: SYSTEM_PROMPT,
      messages: [{ role: 'user', content: JSON.stringify(payload) }],
    });

    if (resp.stop_reason === 'refusal') return [];
    const text = resp.content.find((b) => b.type === 'text')?.text ?? '';
    if (!text) return [];
    const parsed = JSON.parse(text);
    return (parsed.issues || []).map((i) => ({
      type: `semantic-${i.type}`,
      severity: i.severity,
      message: i.message,
      detail: i.evidence,
    }));
  } catch (e) {
    console.warn(`[semantic] check failed for ${url}: ${e?.message || e}`);
    return [];
  }
}
