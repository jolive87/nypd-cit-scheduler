// Storage adapter — dual-write to localStorage (fast cache) + Supabase (cloud sync)
// On load: sync with Supabase using timestamps to always get the latest data.
// Writes go to both localStorage + Supabase simultaneously.
// App works fully offline if Supabase is unreachable.

import { supabase } from './supabase.js';

// --- Sync state (observable by the UI) ---

let _syncStatus = 'pending'; // 'pending' | 'syncing' | 'synced' | 'offline' | 'error'
let _syncListeners = [];

export function getSyncStatus() { return _syncStatus; }
export function onSyncChange(fn) {
  _syncListeners.push(fn);
  return () => { _syncListeners = _syncListeners.filter(f => f !== fn); };
}
function setSyncStatus(s) {
  _syncStatus = s;
  _syncListeners.forEach(fn => fn(s));
}

// --- Supabase helpers ---

function supabaseSet(key, value) {
  if (!supabase) return;
  const ts = new Date().toISOString();
  try { localStorage.setItem(`${key}__ts`, ts); } catch {}
  supabase
    .from('cit_storage')
    .upsert({ key, value, updated_at: ts }, { onConflict: 'key' })
    .then(({ error }) => {
      if (error) console.warn('Supabase write failed:', key, error.message);
    });
}

// Awaitable version — used during initial sync so we don't mark sync done before writes land
async function supabaseSetAsync(key, value) {
  if (!supabase) return;
  const ts = new Date().toISOString();
  try { localStorage.setItem(`${key}__ts`, ts); } catch {}
  const { error } = await supabase
    .from('cit_storage')
    .upsert({ key, value, updated_at: ts }, { onConflict: 'key' });
  if (error) console.warn('Supabase write failed:', key, error.message);
}

function supabaseDelete(key) {
  if (!supabase) return;
  try { localStorage.removeItem(`${key}__ts`); } catch {}
  supabase
    .from('cit_storage')
    .delete()
    .eq('key', key)
    .then(({ error }) => {
      if (error) console.warn('Supabase delete failed:', key, error.message);
    });
}

async function supabaseGet(key) {
  if (!supabase) return null;
  try {
    const { data, error } = await supabase
      .from('cit_storage')
      .select('value')
      .eq('key', key)
      .single();
    if (error || !data) return null;
    return data.value;
  } catch {
    return null;
  }
}

// --- Cloud sync: pull latest from Supabase on every page load ---

let syncDone = false;
let syncPromise = null;

function syncWithSupabase() {
  if (syncDone || !supabase) {
    if (!supabase) setSyncStatus('offline');
    return Promise.resolve();
  }
  if (syncPromise) return syncPromise;

  setSyncStatus('syncing');
  syncPromise = (async () => {
    try {
      const { data, error } = await supabase
        .from('cit_storage')
        .select('key, value, updated_at')
        .like('key', 'cit-v4-%');

      if (error) {
        console.warn('Supabase sync failed:', error.message);
        setSyncStatus('error');
        return;
      }

      // Collect local keys upfront — supabaseSet mutates localStorage (adds __ts keys),
      // so iterating by index during writes skips keys.
      const localCitKeys = [];
      for (let i = 0; i < localStorage.length; i++) {
        const key = localStorage.key(i);
        if (key && key.startsWith('cit-v4-') && !key.endsWith('__ts')) {
          localCitKeys.push(key);
        }
      }

      if (!data || data.length === 0) {
        // No remote data — push local data up to Supabase as initial seed
        const pushPromises = [];
        for (const key of localCitKeys) {
          const value = localStorage.getItem(key);
          if (value) pushPromises.push(supabaseSetAsync(key, value));
        }
        if (pushPromises.length > 0) {
          await Promise.allSettled(pushPromises);
          console.log(`Pushed ${pushPromises.length} local items to Supabase`);
        }
        setSyncStatus('synced');
        syncDone = true;
        return;
      }

      // Compare timestamps: use whichever version is newer
      let updated = 0;
      for (const row of data) {
        const localTs = localStorage.getItem(`${row.key}__ts`);
        const remoteTs = row.updated_at;

        if (!localTs || remoteTs > localTs) {
          // Remote is newer (or local has no timestamp) — use remote
          localStorage.setItem(row.key, row.value);
          localStorage.setItem(`${row.key}__ts`, remoteTs);
          updated++;
        } else if (localTs > remoteTs) {
          // Local is newer — push it up to Supabase now
          const value = localStorage.getItem(row.key);
          if (value) supabaseSet(row.key, value);
        }
      }

      // Also push any local keys that don't exist in Supabase
      const remoteKeys = new Set(data.map(r => r.key));
      for (const key of localCitKeys) {
        if (!remoteKeys.has(key)) {
          const value = localStorage.getItem(key);
          if (value) supabaseSet(key, value);
        }
      }

      if (updated > 0) {
        console.log(`Synced ${updated} items from cloud`);
        // Reload so the app picks up the synced data
        setSyncStatus('synced');
        syncDone = true;
        window.location.reload();
        return;
      }

      setSyncStatus('synced');
      syncDone = true;
    } catch (e) {
      console.warn('Sync failed:', e.message);
      setSyncStatus('error');
    }
  })();

  // Timeout: if Supabase doesn't respond in 5s, proceed with local data
  const timeout = new Promise(resolve => setTimeout(() => {
    if (!syncDone) {
      console.warn('Sync timed out — using local data');
      setSyncStatus('offline');
      syncDone = true;
    }
    resolve();
  }, 5000));

  return Promise.race([syncPromise, timeout]);
}

// Kick off sync immediately on module load
syncWithSupabase();

// --- Storage adapter ---

const storage = {
  async get(key) {
    // Wait for sync to complete (or timeout) before reading
    await syncWithSupabase();
    try {
      const value = localStorage.getItem(key);
      if (value !== null) return { value };

      // localStorage miss — try Supabase directly
      const remote = await supabaseGet(key);
      if (remote !== null) {
        localStorage.setItem(key, remote);
        return { value: remote };
      }
      return null;
    } catch {
      return null;
    }
  },

  async set(key, value) {
    try {
      localStorage.setItem(key, value);
    } catch (e) {
      console.error('Storage write failed:', e);
    }
    supabaseSet(key, value);
  },

  async delete(key) {
    try {
      localStorage.removeItem(key);
    } catch (e) {
      console.error('Storage delete failed:', e);
    }
    supabaseDelete(key);
  },

  async list(prefix) {
    try {
      const keys = [];
      for (let i = 0; i < localStorage.length; i++) {
        const key = localStorage.key(i);
        if (key && key.startsWith(prefix) && !key.endsWith('__ts')) keys.push(key);
      }
      return keys;
    } catch {
      return [];
    }
  },
};

// --- Backup Export/Import ---

export async function exportBackup() {
  const data = {};
  try {
    const config = localStorage.getItem('cit-v4-config');
    if (config) data['cit-v4-config'] = config;

    const welcomed = localStorage.getItem('cit-v4-welcomed');
    if (welcomed) data['cit-v4-welcomed'] = welcomed;

    for (let i = 0; i < localStorage.length; i++) {
      const key = localStorage.key(i);
      if (key && key.startsWith('cit-v4-') && !key.endsWith('__ts') && key !== 'cit-v4-config' && key !== 'cit-v4-welcomed') {
        data[key] = localStorage.getItem(key);
      }
    }
  } catch (e) {
    console.error('Export failed:', e);
  }

  const json = JSON.stringify(data, null, 2);
  const blob = new Blob([json], { type: 'application/json' });
  const url = URL.createObjectURL(blob);
  const link = document.createElement('a');
  link.href = url;
  const dateStr = new Date().toISOString().slice(0, 10);
  link.download = `cit-backup-${dateStr}.json`;
  document.body.appendChild(link);
  link.click();
  document.body.removeChild(link);
  URL.revokeObjectURL(url);
}

export async function importBackup(file) {
  return new Promise((resolve, reject) => {
    const reader = new FileReader();
    reader.onload = (e) => {
      try {
        const data = JSON.parse(e.target.result);
        const keys = Object.keys(data);
        if (keys.length === 0) {
          reject(new Error('Backup file is empty'));
          return;
        }
        const valid = keys.every((k) => k.startsWith('cit-v4'));
        if (!valid) {
          reject(new Error('Invalid backup file format'));
          return;
        }
        for (const [key, value] of Object.entries(data)) {
          localStorage.setItem(key, value);
          supabaseSet(key, value);
        }
        resolve(keys.length);
      } catch (err) {
        reject(new Error('Could not parse backup file'));
      }
    };
    reader.onerror = () => reject(new Error('Could not read file'));
    reader.readAsText(file);
  });
}

export default storage;
