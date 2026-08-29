import { useEffect, useMemo, useRef, useState } from 'react';
import type { Category, Relevance, Submission, Ticket } from '../api';

const AUTOSAVE_DELAY_MS = 900;

function initialScores(categories: Category[], submission?: Submission): Record<string, number> {
  const initial: Record<string, number> = {};
  for (const category of categories) initial[category.id] = submission?.scores?.[category.id] ?? 0;
  return initial;
}

interface FormSnapshot {
  relevance: Relevance;
  scores: Record<string, number>;
  closureReason: string;
  closureInfo: string;
  moreInfo: string;
}

interface Props {
  ticket: Ticket;
  categories: Category[];
  relevanceOptions: Array<{ value: Relevance; label: string }>;
  closureReasons: string[];
  submission?: Submission;
  memberEmail: string;
  disabled: boolean;
  disabledReason?: string;
  onSave: (payload: {
    relevance: Relevance;
    scores?: Record<string, number>;
    closureReason?: string;
    closureInfo?: string;
    moreInfo?: string;
    durationMs?: number;
  }) => Promise<void>;
}

/**
 * The native in-app scoring form that replaces the Microsoft Form: the §8
 * relevance question first, then 0–10 for each category (§6), plus notes.
 */
export function ScoreForm({
  ticket,
  categories,
  relevanceOptions,
  closureReasons,
  submission,
  memberEmail,
  disabled,
  disabledReason,
  onSave,
}: Props) {
  const [relevance, setRelevance] = useState<Relevance>(submission?.relevance ?? 'YES');
  const [scores, setScores] = useState<Record<string, number>>(() => initialScores(categories, submission));
  const [closureReason, setClosureReason] = useState(submission?.closureReason ?? '');
  const [closureInfo, setClosureInfo] = useState(submission?.closureInfo ?? '');
  const [moreInfo, setMoreInfo] = useState(submission?.moreInfo ?? '');
  const [status, setStatus] = useState<{ tone: 'saved' | 'error' | ''; message: string }>({ tone: '', message: '' });
  const [saving, setSaving] = useState(false);

  // When the form was opened, so a save can report how long it took (§9
  // rubber-stamp signal) - and the baseline snapshot autosave compares
  // against, so a ticket nobody has touched never saves on its own.
  const mountedAt = useRef(Date.now());
  const savedSnapshotRef = useRef<string | null>(null);
  if (savedSnapshotRef.current === null) {
    savedSnapshotRef.current = JSON.stringify({
      relevance: submission?.relevance ?? 'YES',
      scores: initialScores(categories, submission),
      closureReason: submission?.closureReason ?? '',
      closureInfo: submission?.closureInfo ?? '',
      moreInfo: submission?.moreInfo ?? '',
    });
  }

  const isRequestor = Boolean(ticket.originalRequestor) && ticket.originalRequestor.toLowerCase() === memberEmail.toLowerCase();
  const total = useMemo(
    () => categories.reduce((sum, category) => sum + (Number(scores[category.id]) || 0), 0),
    [categories, scores],
  );
  const needsReason = relevance === 'NO_CLOSE' || relevance === 'NO_NOT_RELEVANT_TODAY';
  const snapshot: FormSnapshot = { relevance, scores, closureReason, closureInfo, moreInfo };
  const snapshotJson = JSON.stringify(snapshot);

  async function persist(snapshotJson: string, current: FormSnapshot) {
    setSaving(true);
    setStatus({ tone: '', message: '' });
    try {
      await onSave({
        relevance: current.relevance,
        scores: current.relevance === 'YES' ? current.scores : undefined,
        closureReason: current.closureReason || undefined,
        closureInfo: current.closureInfo || undefined,
        moreInfo: current.moreInfo || undefined,
        durationMs: Date.now() - mountedAt.current,
      });
      savedSnapshotRef.current = snapshotJson;
      setStatus({ tone: 'saved', message: 'Saved. You can change your answer until the cut-off.' });
    } catch (err) {
      setStatus({ tone: 'error', message: err instanceof Error ? err.message : 'Could not save' });
    } finally {
      setSaving(false);
    }
  }

  // Autosaves a few seconds after the last change, so scoring many tickets
  // doesn't mean clicking a submit button after every single one - the
  // button below still exists for an explicit, immediate save.
  useEffect(() => {
    if (disabled) return;
    if (needsReason && !closureReason.trim()) return; // not valid to save yet
    if (snapshotJson === savedSnapshotRef.current) return; // nothing new
    const timer = setTimeout(() => {
      persist(snapshotJson, snapshot);
    }, AUTOSAVE_DELAY_MS);
    return () => clearTimeout(timer);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [disabled, snapshotJson]);

  async function submit(event: React.FormEvent) {
    event.preventDefault();
    await persist(snapshotJson, snapshot);
  }

  const groupName = `relevance-${ticket.id}`;

  return (
    <form onSubmit={submit} style={{ marginTop: '1rem' }}>
      <fieldset disabled={disabled}>
        <legend>Is this relevant?</legend>
        {relevanceOptions.map((option) => {
          const requestorOnly = option.value === 'NO_NOT_RELEVANT_TODAY';
          const blocked = requestorOnly && !isRequestor;
          return (
            <label className="relevance-option" key={option.value} htmlFor={`${groupName}-${option.value}`}>
              <input
                type="radio"
                id={`${groupName}-${option.value}`}
                name={groupName}
                value={option.value}
                checked={relevance === option.value}
                disabled={blocked}
                onChange={() => setRelevance(option.value)}
              />
              <span>
                {option.label}
                {blocked ? <span className="hint">Only the original requestor can choose this.</span> : null}
              </span>
            </label>
          );
        })}
      </fieldset>

      {relevance === 'YES' ? (
        <fieldset disabled={disabled}>
          <legend>Impact scores (0–10)</legend>
          <div className="score-grid">
            {categories.map((category) => {
              const inputId = `score-${ticket.id}-${category.id}`;
              return (
                <div className="score-row" key={category.id}>
                  <label htmlFor={inputId} className="cat-name">
                    {category.name}
                    <span className="cat-desc">{category.description}</span>
                    <span className="cat-desc">
                      {category.scaleMin} = {category.zeroLabel} · {category.scaleMax} = {category.maxLabel}
                    </span>
                  </label>
                  <input
                    id={inputId}
                    type="range"
                    min={category.scaleMin}
                    max={category.scaleMax}
                    step={1}
                    value={scores[category.id] ?? 0}
                    onChange={(event) => setScores({ ...scores, [category.id]: Number(event.target.value) })}
                    aria-describedby={`${inputId}-out`}
                  />
                  <output id={`${inputId}-out`} htmlFor={inputId}>
                    {scores[category.id] ?? 0}
                  </output>
                </div>
              );
            })}
          </div>
          <p className="total-line">
            Your total for this ticket: {total} / {categories.reduce((sum, c) => sum + c.scaleMax, 0)}
          </p>
        </fieldset>
      ) : null}

      {relevance === 'NO_CLOSE' || relevance === 'NO_NOT_RELEVANT_TODAY' ? (
        <fieldset disabled={disabled}>
          <legend>{relevance === 'NO_CLOSE' ? 'Reason for closure' : 'Why is it not relevant today?'}</legend>
          <div className="field">
            <label htmlFor={`reason-${ticket.id}`}>Reason</label>
            {relevance === 'NO_CLOSE' ? (
              <select id={`reason-${ticket.id}`} value={closureReason} onChange={(e) => setClosureReason(e.target.value)} required>
                <option value="">Choose a reason…</option>
                {closureReasons.map((reason) => (
                  <option key={reason} value={reason}>
                    {reason}
                  </option>
                ))}
              </select>
            ) : (
              <input
                type="text"
                id={`reason-${ticket.id}`}
                value={closureReason}
                onChange={(e) => setClosureReason(e.target.value)}
                required
              />
            )}
          </div>
          <div className="field">
            <label htmlFor={`info-${ticket.id}`}>Anything else? (optional)</label>
            <textarea id={`info-${ticket.id}`} value={closureInfo} onChange={(e) => setClosureInfo(e.target.value)} />
          </div>
        </fieldset>
      ) : null}

      <div className="field">
        <label htmlFor={`notes-${ticket.id}`}>Notes or questions (optional)</label>
        <textarea
          id={`notes-${ticket.id}`}
          value={moreInfo}
          disabled={disabled}
          onChange={(e) => setMoreInfo(e.target.value)}
          placeholder="Anything the coordinator should know, or a query for the requestor"
        />
      </div>

      <div className="row">
        <button type="submit" disabled={disabled || saving}>
          {saving ? 'Saving…' : submission ? 'Update my score' : 'Submit my score'}
        </button>
        <span className="hint">
          {submission ? `Last saved ${new Date(submission.updatedAt).toLocaleString('en-GB')}. ` : ''}
          Saves automatically a few seconds after each change — the button saves immediately.
        </span>
      </div>

      <p className={`status ${status.tone}`} role="status" aria-live="polite">
        {disabled ? disabledReason ?? 'Scoring is closed for this round.' : status.message}
      </p>
    </form>
  );
}
