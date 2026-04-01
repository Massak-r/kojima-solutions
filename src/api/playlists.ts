const BASE = '/api/playlists.php';
const ITEMS_BASE = '/api/playlist_items.php';

export interface PlaylistItem {
  id:         string;
  playlistId: string;
  moveId:     string;
  sortOrder:  number;
}

export interface Playlist {
  id:        string;
  type:      'figures' | 'solo';
  email:     string;
  name:      string;
  isShared:  boolean;
  createdAt: string;
  items:     PlaylistItem[];
}

/** Load playlists for a user (their own + all shared ones for the type) */
export async function listPlaylists(type: string, email: string): Promise<Playlist[]> {
  const r = await fetch(`${BASE}?type=${encodeURIComponent(type)}&email=${encodeURIComponent(email)}`);
  if (!r.ok) throw new Error('listPlaylists failed');
  return r.json();
}

/** Admin: load all playlists for a type */
export async function listAllPlaylists(type: string): Promise<Playlist[]> {
  const r = await fetch(`${BASE}?type=${encodeURIComponent(type)}`);
  if (!r.ok) throw new Error('listAllPlaylists failed');
  return r.json();
}

export async function createPlaylist(data: {
  type: 'figures' | 'solo';
  email: string;
  name: string;
  isShared?: boolean;
}): Promise<Playlist> {
  const r = await fetch(BASE, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(data),
  });
  if (!r.ok) throw new Error('createPlaylist failed');
  return r.json();
}

export async function updatePlaylist(
  id: string,
  data: { name?: string; isShared?: boolean }
): Promise<Playlist> {
  const r = await fetch(`${BASE}?id=${id}`, {
    method: 'PATCH',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(data),
  });
  if (!r.ok) throw new Error('updatePlaylist failed');
  return r.json();
}

export async function deletePlaylist(id: string): Promise<void> {
  const r = await fetch(`${BASE}?id=${id}`, { method: 'DELETE' });
  if (!r.ok) throw new Error('deletePlaylist failed');
}

export async function addToPlaylist(playlistId: string, moveId: string): Promise<PlaylistItem> {
  const r = await fetch(ITEMS_BASE, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ playlistId, moveId }),
  });
  if (!r.ok) throw new Error('addToPlaylist failed');
  return r.json();
}

export async function removeFromPlaylist(playlistId: string, moveId: string): Promise<void> {
  const r = await fetch(
    `${ITEMS_BASE}?playlist_id=${playlistId}&move_id=${moveId}`,
    { method: 'DELETE' }
  );
  if (!r.ok) throw new Error('removeFromPlaylist failed');
}
