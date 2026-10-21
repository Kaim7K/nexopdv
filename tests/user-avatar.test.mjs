import test from 'node:test';
import assert from 'node:assert/strict';
import { AVATAR_COLORS, avatarColor, avatarInitial, normalizeAvatarColor, randomAvatarColor } from '../src/lib/user-avatar.js';
import { contrastRatio } from '../src/lib/color-contrast.js';
import { handleEntityRequest } from '../server/entities/routes.js';

test('every allowed avatar background has readable contrast against a white initial', () => {
  for (const color of AVATAR_COLORS) assert.ok(contrastRatio(color, '#ffffff') >= 4.5, color);
  assert.equal(normalizeAvatarColor('#ffff88'), null);
  assert.equal(normalizeAvatarColor('url(untrusted)'), null);
  for (let i = 0; i < 50; i++) assert.ok(AVATAR_COLORS.includes(randomAvatarColor()));
});

test('avatars keep saved colors and display one accented initial', () => {
  assert.equal(avatarInitial('  Érica Silva'), 'É');
  assert.equal(avatarInitial(''), 'U');
  assert.equal(avatarColor({ id: 'a', avatar_color: '#1d4ed8' }), '#1d4ed8');
  assert.equal(avatarColor({ id: 'legacy' }), avatarColor({ id: 'legacy' }));
});

test('only administrators can change avatar colors and unreadable colors are rejected', async () => {
  for (const [role, avatar_color, expected] of [['gerente', AVATAR_COLORS[0], 403], ['admin', '#ffff88', 400]]) {
    const res = { getHeader() {}, setHeader() {}, status(code) { this.statusCode = code; return this; }, json(data) { return data; } };
    await handleEntityRequest({ req: { method: 'PATCH', body: { avatar_color } }, res, sql: () => { throw Error('Invalid requests must not query the database'); }, user: { role }, path: ['entities', 'User', 'id'] }, { ENTITIES: { User: 'users' } });
    assert.equal(res.statusCode, expected);
  }
});
