/**
 * IndexedDB Storage Helper for Creative Portfolio
 * Stores user-uploaded media (images & videos) with persistent local browser storage.
 */

const DB_NAME = 'CreativePortfolioDB';
const DB_VERSION = 1;
const STORE_NAME = 'user_uploads';

const DELETED_ITEMS_KEY = 'creative_portfolio_deleted_ids';

class PortfolioStorage {
  constructor() {
    this.db = null;
    this.initPromise = this.init();
  }

  async init() {
    return new Promise((resolve, reject) => {
      const request = indexedDB.open(DB_NAME, DB_VERSION);

      request.onupgradeneeded = (event) => {
        const db = event.target.result;
        if (!db.objectStoreNames.contains(STORE_NAME)) {
          const store = db.createObjectStore(STORE_NAME, { keyPath: 'id' });
          store.createIndex('category', 'category', { unique: false });
          store.createIndex('timestamp', 'timestamp', { unique: false });
        }
      };

      request.onsuccess = (event) => {
        this.db = event.target.result;
        resolve(this.db);
      };

      request.onerror = (event) => {
        console.error('IndexedDB failed to open:', event.target.error);
        reject(event.target.error);
      };
    });
  }

  async ready() {
    if (!this.db) {
      await this.initPromise;
    }
    return this.db;
  }

  async addItem(item) {
    const db = await this.ready();
    return new Promise((resolve, reject) => {
      const tx = db.transaction([STORE_NAME], 'readwrite');
      const store = tx.objectStore(STORE_NAME);
      const request = store.put(item);

      request.onsuccess = () => resolve(item);
      request.onerror = (e) => reject(e.target.error);
    });
  }

  async getAllItems() {
    const db = await this.ready();
    return new Promise((resolve, reject) => {
      const tx = db.transaction([STORE_NAME], 'readonly');
      const store = tx.objectStore(STORE_NAME);
      const request = store.getAll();

      request.onsuccess = () => {
        // Sort newest first
        const items = request.result || [];
        items.sort((a, b) => (b.timestamp || 0) - (a.timestamp || 0));
        resolve(items);
      };
      request.onerror = (e) => reject(e.target.error);
    });
  }

  async getItemsByCategory(category) {
    const all = await this.getAllItems();
    return all.filter(item => item.category === category);
  }

  getDeletedIds() {
    try {
      const data = localStorage.getItem(DELETED_ITEMS_KEY);
      return data ? new Set(JSON.parse(data)) : new Set();
    } catch (e) {
      return new Set();
    }
  }

  addDeletedId(id) {
    try {
      const set = this.getDeletedIds();
      set.add(id);
      localStorage.setItem(DELETED_ITEMS_KEY, JSON.stringify([...set]));
    } catch (e) {
      console.error('Failed to store deleted ID:', e);
    }
  }

  restoreDeletedDefaults() {
    try {
      localStorage.removeItem(DELETED_ITEMS_KEY);
    } catch (e) {
      console.error('Failed to restore defaults:', e);
    }
  }

  async deleteItem(id) {
    // Record as deleted so even default items disappear
    this.addDeletedId(id);

    const db = await this.ready();
    return new Promise((resolve) => {
      const tx = db.transaction([STORE_NAME], 'readwrite');
      const store = tx.objectStore(STORE_NAME);
      const request = store.delete(id);

      request.onsuccess = () => resolve(true);
      request.onerror = () => resolve(true); // Always succeed even if id was default item
    });
  }

  async deleteItemByTitleOrMatch(term) {
    if (!term) return;
    try {
      const all = await this.getAllItems();
      for (const item of all) {
        if ((item.title && item.title.toLowerCase().includes(term.toLowerCase())) ||
            (item.description && item.description.toLowerCase().includes(term.toLowerCase()))) {
          await this.deleteItem(item.id);
        }
      }
    } catch (e) {
      console.warn('Could not match/delete item:', e);
    }
  }

  async clearAllUserUploads() {
    const db = await this.ready();
    return new Promise((resolve, reject) => {
      const tx = db.transaction([STORE_NAME], 'readwrite');
      const store = tx.objectStore(STORE_NAME);
      const request = store.clear();

      request.onsuccess = () => resolve(true);
      request.onerror = (e) => reject(e.target.error);
    });
  }
}

// Global instance
window.portfolioStorage = new PortfolioStorage();
