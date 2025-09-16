// Data structure versions
const CURRENT_DATA_VERSION = 1;
const DEFAULT_STATE = {
  version: CURRENT_DATA_VERSION,
  repository: [],
  analysisHistory: [],
  detectedGaps: [],
  errorLogs: [],
  settings: {
    analysisThreshold: 50,
    maxHistoryItems: 100,
    offlineMode: false,
    lastSync: null
  }
};

// Data migration functions
const migrationFunctions = {
  0: async (oldData) => {
    // Migrate from unversioned to version 1
    return {
      ...DEFAULT_STATE,
      repository: oldData.repository || [],
      analysisHistory: oldData.analysisHistory || [],
      detectedGaps: oldData.detectedGaps || []
    };
  }
};

// Initialize or migrate storage
chrome.runtime.onInstalled.addListener(async () => {
  try {
    const data = await chrome.storage.local.get(null);
    const currentVersion = data.version || 0;

    if (currentVersion < CURRENT_DATA_VERSION) {
      let migratedData = { ...data };
      
      // Apply each migration sequentially
      for (let v = currentVersion; v < CURRENT_DATA_VERSION; v++) {
        if (migrationFunctions[v]) {
          migratedData = await migrationFunctions[v](migratedData);
        }
      }

      // Save migrated data
      await chrome.storage.local.set(migratedData);
      console.log(`Data migrated from version ${currentVersion} to ${CURRENT_DATA_VERSION}`);
    } else if (Object.keys(data).length === 0) {
      // Fresh installation
      await chrome.storage.local.set(DEFAULT_STATE);
      console.log('Storage initialized with default state');
    }
  } catch (error) {
    console.error('Storage initialization/migration failed:', error);
    // Report error to monitoring service if available
  }
});

// Rate limiting configuration
const rateLimits = {
  'log_gap': { maxRequests: 5, timeWindow: 1000 }, // 5 requests per second
  'get_repository': { maxRequests: 2, timeWindow: 1000 } // 2 requests per second
};

const requestCounts = new Map();

// Retry configuration
const RETRY_ATTEMPTS = 3;
const RETRY_DELAY = 1000; // 1 second

// Rate limiting function
const checkRateLimit = (action) => {
  const limit = rateLimits[action];
  if (!limit) return true;

  const now = Date.now();
  const key = `${action}_${Math.floor(now / limit.timeWindow)}`;
  const count = requestCounts.get(key) || 0;

  if (count >= limit.maxRequests) return false;

  requestCounts.set(key, count + 1);
  setTimeout(() => requestCounts.delete(key), limit.timeWindow);
  return true;
};

// Retry mechanism
const retryOperation = async (operation, attempts = RETRY_ATTEMPTS) => {
  for (let i = 0; i < attempts; i++) {
    try {
      return await operation();
    } catch (error) {
      if (i === attempts - 1) throw error;
      await new Promise(resolve => setTimeout(resolve, RETRY_DELAY * (i + 1)));
    }
  }
};

// Error logging
const logError = async (error, context, severity = 'error') => {
  try {
    const { errorLogs } = await chrome.storage.local.get('errorLogs');
    const logs = errorLogs || [];
    logs.unshift({
      timestamp: new Date().toISOString(),
      context,
      message: error.message,
      stack: error.stack,
      severity
    });

    // Keep only last 100 error logs
    while (logs.length > 100) logs.pop();

    await chrome.storage.local.set({ errorLogs: logs });
  } catch (e) {
    console.error('Failed to log error:', e);
  }
};

// Message handling
chrome.runtime.onMessage.addListener((request, sender, sendResponse) => {
  const handleError = async (error, context) => {
    await logError(error, context);
    sendResponse({ 
      success: false, 
      error: error.message,
      retryAfter: RETRY_DELAY 
    });
  };

  try {
    if (!checkRateLimit(request.action)) {
      sendResponse({ 
        success: false, 
        error: 'Rate limit exceeded',
        retryAfter: rateLimits[request.action]?.timeWindow || 1000
      });
      return;
    }

    switch (request.action) {
      case "log_gap":
        retryOperation(async () => {
          const { repository, settings } = await chrome.storage.local.get(['repository', 'settings']);
          const newGap = {
            ...request.data,
            timestamp: new Date().toISOString(),
            source: sender.tab?.url,
            offlineCreated: settings.offlineMode
          };

          const updatedRepo = [...(repository || []), newGap];
          await chrome.storage.local.set({ 
            repository: updatedRepo.slice(-settings.maxHistoryItems) 
          });
          sendResponse({ success: true });
        }).catch(error => handleError(error, 'log_gap'));
        return true;

      case "get_repository":
        retryOperation(async () => {
          const { repository, settings } = await chrome.storage.local.get(['repository', 'settings']);
          sendResponse({ 
            success: true, 
            data: repository || [],
            offlineMode: settings.offlineMode
          });
        }).catch(error => handleError(error, 'get_repository'));
        return true;

      case "toggle_offline_mode":
        retryOperation(async () => {
          const { settings } = await chrome.storage.local.get('settings');
          await chrome.storage.local.set({
            settings: {
              ...settings,
              offlineMode: !settings.offlineMode,
              lastSync: settings.offlineMode ? new Date().toISOString() : settings.lastSync
            }
          });
          sendResponse({ success: true, offlineMode: !settings.offlineMode });
        }).catch(error => handleError(error, 'toggle_offline_mode'));
        return true;

      case "sync_data":
        retryOperation(async () => {
          const { repository, settings } = await chrome.storage.local.get(['repository', 'settings']);
          if (settings.offlineMode) {
            sendResponse({ success: false, error: 'Sync not available in offline mode' });
            return;
          }

          // Here you would implement your sync logic with a server
          // For now, we'll just update the lastSync timestamp
          await chrome.storage.local.set({
            settings: {
              ...settings,
              lastSync: new Date().toISOString()
            }
          });
          sendResponse({ success: true });
        }).catch(error => handleError(error, 'sync_data'));
        return true;

      case "get_error_logs":
        retryOperation(async () => {
          const { errorLogs } = await chrome.storage.local.get('errorLogs');
          sendResponse({ success: true, data: errorLogs || [] });
        }).catch(error => handleError(error, 'get_error_logs'));
        return true;

      case "clear_error_logs":
        retryOperation(async () => {
          await chrome.storage.local.set({ errorLogs: [] });
          sendResponse({ success: true });
        }).catch(error => handleError(error, 'clear_error_logs'));
        return true;

      default:
        sendResponse({ 
          success: false, 
          error: 'Unknown action' 
        });
    }
  } catch (error) {
    handleError(error, 'message_handler');
  }
});