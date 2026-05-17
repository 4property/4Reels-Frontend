/**
 * Pure-JS unit tests for `mapPublishStatus` (feature 14).
 *
 * Run with: node --test tests/unit/publishStatus.unit.js
 *
 * Uses node's built-in test runner (no Vitest, no extra deps). The function
 * under test lives in `src/features/reels/publishStatus.js` and is a pure
 * string→string mapper with no React or DOM dependencies, so we can import
 * it directly.
 *
 * Covers the publish_status values the backend actually emits today:
 *   pending, pending_review, pending_publish, skipped, failed, rejected,
 *   published, partial, approved (alias). Also asserts the legacy alias
 *   `awaiting_review` keeps mapping to `needs-approval` for compatibility
 *   with old data.
 */
import { test } from 'node:test';
import assert from 'node:assert/strict';
import { mapPublishStatus } from '../../src/features/reels/publishStatus.js';

test('awaiting_review (legacy alias) maps to "needs-approval"', () => {
  assert.equal(mapPublishStatus('awaiting_review', null), 'needs-approval');
});

test('pending_review (actual backend value) maps to "needs-approval"', () => {
  assert.equal(mapPublishStatus('pending_review', null), 'needs-approval');
});

test('pending_publish maps to "publishing"', () => {
  assert.equal(mapPublishStatus('pending_publish', null), 'publishing');
});

test('skipped maps to "skipped"', () => {
  assert.equal(mapPublishStatus('skipped', null), 'skipped');
});

test('published maps to "published"', () => {
  assert.equal(mapPublishStatus('published', null), 'published');
});

test('partial maps to "published" (partial success is still a publish)', () => {
  assert.equal(mapPublishStatus('partial', null), 'published');
});

test('approved maps to "published"', () => {
  assert.equal(mapPublishStatus('approved', null), 'published');
});

test('rejected maps to "rejected"', () => {
  assert.equal(mapPublishStatus('rejected', null), 'rejected');
});

test('failed maps to "failed"', () => {
  assert.equal(mapPublishStatus('failed', null), 'failed');
});

test('empty publish_status falls back to "pending"', () => {
  assert.equal(mapPublishStatus('', null), 'pending');
});

test('null publish_status with null workflow_state falls back to "pending"', () => {
  assert.equal(mapPublishStatus(null, null), 'pending');
});

test('falls back to workflow_state when publish_status is empty', () => {
  assert.equal(mapPublishStatus(null, 'rendering'), 'rendering');
});

test('is case-insensitive: PENDING_REVIEW maps to "needs-approval"', () => {
  assert.equal(mapPublishStatus('PENDING_REVIEW', null), 'needs-approval');
});

test('unknown status passes through verbatim', () => {
  assert.equal(mapPublishStatus('unknown_state', null), 'unknown_state');
});
