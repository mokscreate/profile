const USERS_KEY = 'resume-craft-users';
const ACTIVE_USER_KEY = 'resume-craft-active-user';

function uid() {
  return 'user_' + Date.now().toString(36) + Math.random().toString(36).slice(2, 7);
}

function getUserRegistry() {
  const saved = localStorage.getItem(USERS_KEY);
  if (saved) return JSON.parse(saved);
  return { users: [], version: 1 };
}

function saveRegistry(registry) {
  localStorage.setItem(USERS_KEY, JSON.stringify(registry));
}

export function getUsers() {
  return getUserRegistry().users;
}

export function createUser(name, emoji = '') {
  const registry = getUserRegistry();
  const user = {
    id: uid(),
    name,
    emoji: emoji || getDefaultEmoji(registry.users.length),
    createdAt: new Date().toISOString()
  };
  registry.users.push(user);
  saveRegistry(registry);
  return user;
}

export function deleteUser(userId) {
  const registry = getUserRegistry();
  registry.users = registry.users.filter(u => u.id !== userId);
  saveRegistry(registry);
  localStorage.removeItem(`resume-craft-v2-${userId}`);
  if (getActiveUserId() === userId) {
    localStorage.removeItem(ACTIVE_USER_KEY);
  }
}

export function getActiveUserId() {
  return localStorage.getItem(ACTIVE_USER_KEY) || null;
}

export function getActiveUser() {
  const id = getActiveUserId();
  if (!id) return null;
  const users = getUsers();
  return users.find(u => u.id === id) || null;
}

export function setActiveUser(userId) {
  localStorage.setItem(ACTIVE_USER_KEY, userId);
}

export function migrateFromLegacy() {
  if (localStorage.getItem(USERS_KEY)) return false;

  const legacyData = localStorage.getItem('resume-craft-v2');
  if (!legacyData) return false;

  const parsed = JSON.parse(legacyData);
  const name = parsed.profile?.name || '默认用户';

  const user = createUser(name);
  localStorage.setItem(`resume-craft-v2-${user.id}`, legacyData);
  localStorage.removeItem('resume-craft-v2');
  setActiveUser(user.id);
  return true;
}

export function getStorageKeyForUser(userId) {
  return `resume-craft-v2-${userId}`;
}

const DEFAULT_EMOJIS = ['😊', '🚀', '🎨', '💡', '🌟', '🎯', '📝', '🔥', '🌈', '🎵', '🍀', '⭐'];

function getDefaultEmoji(index) {
  return DEFAULT_EMOJIS[index % DEFAULT_EMOJIS.length];
}

export { DEFAULT_EMOJIS };
