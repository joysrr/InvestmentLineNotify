// src/api/utils/downloadTicket.mjs
// One-time short-lived download ticket store.
// Ticket TTL is 60 seconds; each ticket can only be redeemed once.
import { randomUUID } from "node:crypto";

const TICKET_TTL_MS = 60_000; // 60 seconds

// Map<ticketId, { reportPath: string, expiresAt: number }>
const _tickets = new Map();

/**
 * Create a one-time download ticket for the given report path.
 * @param {string} reportPath  Absolute path to the evidence report file.
 * @returns {string} ticketId  UUID to be passed as ?ticket= query param.
 */
export function createTicket(reportPath) {
  const id = randomUUID();
  const expiresAt = Date.now() + TICKET_TTL_MS;
  _tickets.set(id, { reportPath, expiresAt });

  // Auto-cleanup after TTL to avoid memory accumulation
  setTimeout(() => {
    _tickets.delete(id);
  }, TICKET_TTL_MS);

  return id;
}

/**
 * Redeem a ticket. Returns the reportPath if valid, null otherwise.
 * Ticket is immediately invalidated after the first successful redemption.
 * @param {string} ticketId
 * @returns {string|null}
 */
export function redeemTicket(ticketId) {
  const entry = _tickets.get(ticketId);
  if (!entry) return null;

  if (Date.now() > entry.expiresAt) {
    _tickets.delete(ticketId);
    return null;
  }

  // One-time: delete immediately after use
  _tickets.delete(ticketId);
  return entry.reportPath;
}
