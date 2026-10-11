import { query, ValidationChain } from 'express-validator';

export const REVIEW_STATUSES = ['pending', 'approved', 'published', 'rejected'];

export function escapeRegex(str: string): string {
  return str.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
}

export const statusFilter = (allowed: string[] = REVIEW_STATUSES): ValidationChain =>
  query('status').optional().isIn(allowed).withMessage(`status must be one of: ${allowed.join(', ')}`);

export const searchFilter = (): ValidationChain =>
  query('q').optional().isString().trim().isLength({ max: 100 }).withMessage('q must be 100 characters or fewer');

export const pageFilters = (): ValidationChain[] => [
  query('page').optional().isInt({ min: 1 }).withMessage('page must be a positive number'),
  query('limit').optional().isInt({ min: 1, max: 50 }).withMessage('limit must be between 1 and 50'),
];

// Case-insensitive "contains" match for a user-typed search; undefined when there is nothing to search for
export function searchRegex(q: unknown): RegExp | undefined {
  const text = typeof q === 'string' ? q.trim() : '';
  return text ? new RegExp(escapeRegex(text), 'i') : undefined;
}
