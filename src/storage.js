// Storage adapter — maps the window.storage API (from Claude.ai artifacts) to localStorage
// Provides the same async interface so the component code needs minimal changes.

const storage = {
  async get(key) {
    try {
      const value = localStorage.getItem(key);
      if (value === null) return null;
      return { value };
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
  },

  async delete(key) {
    try {
      localStorage.removeItem(key);
    } catch (e) {
      console.error('Storage delete failed:', e);
    }
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
    // Export config
    const config = localStorage.getItem('cit-v4-config');
    if (config) data['cit-v4-config'] = config;

    // Export welcome flag
    const welcomed = localStorage.getItem('cit-v4-welcomed');
    if (welcomed) data['cit-v4-welcomed'] = welcomed;

    // Export all monthly data
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
        // Validate structure — all keys should start with cit-v4
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
        // Write all keys to localStorage
        for (const [key, value] of Object.entries(data)) {
          localStorage.setItem(key, value);
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
