/**
 * A safe wrapper for localStorage that catches QuotaExceededError and other storage-related exceptions.
 */
export const safeLocalStorage = {
  setItem: (key: string, value: string): boolean => {
    try {
      localStorage.setItem(key, value);
      return true;
    } catch (e) {
      if (e instanceof DOMException && (
        e.code === 22 || 
        e.code === 1014 || 
        e.name === 'QuotaExceededError' || 
        e.name === 'NS_ERROR_DOM_QUOTA_REACHED'
      )) {
        console.warn(`[Storage] LocalStorage quota exceeded for key: "${key}". The data remains in application state and will be synced to the server if online, but it won't persist if you refresh until space is cleared.`);
        return false;
      }
      console.error(`[Storage] Unchecked localStorage error for key "${key}":`, e);
      return false;
    }
  },

  getItem: (key: string): string | null => {
    try {
      return localStorage.getItem(key);
    } catch (e) {
      console.error(`[Storage] Error reading key "${key}" from localStorage:`, e);
      return null;
    }
  },

  removeItem: (key: string): void => {
    try {
      localStorage.removeItem(key);
    } catch (e) {
      console.error(`[Storage] Error removing key "${key}" from localStorage:`, e);
    }
  },

  clear: (): void => {
    try {
      localStorage.clear();
    } catch (e) {
      console.error(`[Storage] Error clearing localStorage:`, e);
    }
  }
};
