// Storage adapter — dual-write to localStorage (fast cache) + Supabase (cloud backup)
// localStorage is always the primary read source. Supabase syncs in background.
// App works fully offline if Supabase is unreachable.

import { supabase } from './supabase.js';

// --- Supabase helpers (fire-and-forget, never block the UI) ---

function supabaseSet(key, value) {
  if (!supabase) return;
  supabase
    .from('cit_storage')
    .upsert({ key, value, updated_at: new Date().toISOString() }, { onConflict: 'key' })
    .then(({ error }) => {
      if (error) console.warn('Supabase write failed:', key, error.message);
    });
}

function supabaseDelete(key) {
  if (!supabase) return;
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

async function supabaseList(prefix) {
  if (!supabase) return [];
  try {
    const { data, error } = await supabase
      .from('cit_storage')
      .select('key')
      .like('key', `${prefix}%`);
    if (error || !data) return [];
    return data.map((row) => row.key);
  } catch {
    return [];
  }
}

// --- Device migration: restore from Supabase if localStorage is empty ---

let migrationDone = false;

async function migrateFromSupabase() {
  if (migrationDone || !supabase) return;
  migrationDone = true;

  // Check if localStorage already has CIT data
  let hasLocalData = false;
  for (let i = 0; i < localStorage.length; i++) {
    if (localStorage.key(i)?.startsWith('cit-v4-')) {
      hasLocalData = true;
      break;
    }
  }
  if (hasLocalData) return;

  // localStorage is empty — try restoring from Supabase
  try {
    const { data, error } = await supabase
      .from('cit_storage')
      .select('key, value')
      .like('key', 'cit-v4-%');
    if (error || !data || data.length === 0) return;

    for (const row of data) {
      localStorage.setItem(row.key, row.value);
    }
    console.log(`Restored ${data.length} items from Supabase`);
    // Reload so the app picks up the restored data
    window.location.reload();
  } catch (e) {
    console.warn('Supabase migration failed:', e.message);
  }
}

// Kick off migration immediately on module load
migrateFromSupabase();

// --- Storage adapter (same API as before) ---

const storage = {
  async get(key) {
    try {
      const value = localStorage.getItem(key);
      if (value !== null) return { value };

      // localStorage miss — try Supabase
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
        if (key && key.startsWith(prefix)) keys.push(key);
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
      if (key && key.startsWith('cit-v4-') && key !== 'cit-v4-config' && key !== 'cit-v4-welcomed') {
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
