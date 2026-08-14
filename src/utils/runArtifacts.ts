/**
 * Run artefact recording (spec §8 — cleanup).
 *
 * Automated cleanup of UAT data is not available yet, so the next best thing is
 * visibility: every account and order a run creates is appended to a JSON Lines
 * file under `artifacts/`. That file is uploaded by CI, which makes data
 * build-up in UAT observable and gives whoever eventually writes the cleanup
 * job an exact list to work from.
 *
 * JSON Lines rather than a single JSON document because workers append
 * concurrently — one line per record is atomic enough for this purpose, whereas
 * rewriting a whole array is not.
 */
import { appendFileSync, mkdirSync } from 'node:fs';
import { dirname, join } from 'node:path';
import type { SiteKey } from '../../config/types.js';

const ARTIFACT_DIR = 'artifacts';
const CREATED_DATA_FILE = join(ARTIFACT_DIR, 'created-data.jsonl');

/** Something a test created in UAT that will need cleaning up eventually. */
export interface CreatedRecord {
  kind: 'account' | 'order' | 'erp-document';
  /** Email, order reference, or SAP document number. */
  identifier: string;
  site?: SiteKey;
  /** Test that created it, for tracing back. */
  createdBy: string;
  createdAt: string;
  notes?: string;
}

/**
 * Records a created entity to the run artefact.
 *
 * Never throws: a failure to record must not fail a test that otherwise passed.
 * A recording failure is reported on stderr so it is visible without being fatal.
 */
export function recordCreated(record: Omit<CreatedRecord, 'createdAt'>): void {
  const entry: CreatedRecord = { ...record, createdAt: new Date().toISOString() };

  try {
    mkdirSync(dirname(CREATED_DATA_FILE), { recursive: true });
    appendFileSync(CREATED_DATA_FILE, `${JSON.stringify(entry)}\n`, 'utf8');
  } catch (error) {
    console.error(
      `[runArtifacts] Could not record created ${record.kind} "${record.identifier}": ${String(error)}`
    );
  }
}

/** Convenience wrapper for a created customer account. */
export function recordCreatedAccount(email: string, site: SiteKey, testTitle: string): void {
  recordCreated({ kind: 'account', identifier: email, site, createdBy: testTitle });
}

/** Convenience wrapper for a placed order. */
export function recordCreatedOrder(
  orderReference: string,
  site: SiteKey,
  testTitle: string,
  notes?: string
): void {
  recordCreated({
    kind: 'order',
    identifier: orderReference,
    site,
    createdBy: testTitle,
    ...(notes !== undefined ? { notes } : {}),
  });
}

/** Convenience wrapper for a document created in the ERP. */
export function recordCreatedErpDocument(
  documentNumber: string,
  testTitle: string,
  notes?: string
): void {
  recordCreated({
    kind: 'erp-document',
    identifier: documentNumber,
    createdBy: testTitle,
    ...(notes !== undefined ? { notes } : {}),
  });
}
