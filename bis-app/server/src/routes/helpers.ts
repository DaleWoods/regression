import type { NextFunction, Request, RequestHandler, Response } from 'express';
import { ZodError } from 'zod';
import { HttpishError } from '../services/roundService.js';
import { JiraApiError, JiraNotConfiguredError } from '../integrations/jira.js';
import { GraphNotConfiguredError } from '../integrations/graph.js';
import { logError } from '../util/logger.js';

export function asyncHandler(handler: (req: Request, res: Response, next: NextFunction) => Promise<unknown>): RequestHandler {
  return (req, res, next) => {
    handler(req, res, next).catch(next);
  };
}

export function errorHandler(err: unknown, req: Request, res: Response, _next: NextFunction): void {
  if (err instanceof HttpishError) {
    res.status(err.status).json({ error: err.message });
    return;
  }
  if (err instanceof ZodError) {
    res.status(400).json({ error: 'Invalid request', details: err.issues });
    return;
  }
  if (err instanceof JiraNotConfiguredError || err instanceof GraphNotConfiguredError) {
    res.status(503).json({ error: err.message });
    return;
  }
  if (err instanceof JiraApiError) {
    res.status(502).json({ error: err.message });
    return;
  }
  // Everything above is an expected, named failure mode with its own status
  // code - what lands here is the unexpected kind, worth a full stack trace.
  logError('http.unhandled', err, { method: req.method, path: req.path, memberId: req.member?.id ?? null });
  res.status(500).json({ error: err instanceof Error ? err.message : 'Unexpected error' });
}

export function actorOf(req: Request): { id: string | null; email: string } {
  return { id: req.member?.id ?? null, email: req.member?.email ?? '' };
}
