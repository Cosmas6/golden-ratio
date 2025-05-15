// Deriv WebSocket Client
// Based on the official Deriv API documentation

// App ID options - if one fails, try another
const APP_IDS = {
  ORIGINAL: 75914,  // Your original app_id (keeping this value as you confirmed it's accurate)
  DEMO: 1089        // Deriv's official demo app_id (just as a fallback)
};

/**
 * Creates a new WebSocket connection to Deriv API
 * @param {number} appId - The application ID to use
 * @returns {WebSocket} - The WebSocket instance
 */
export const createDerivSocket = (appId = APP_IDS.ORIGINAL) => {
  console.log(`Creating WebSocket with app_id: ${appId}`);
  return new WebSocket(`wss://ws.derivws.com/websockets/v3?app_id=${appId}`);
};

/**
 * Sets up event handlers for the WebSocket
 * @param {WebSocket} socket - The WebSocket instance
 * @param {Object} handlers - Event handlers
 * @param {Function} handlers.onOpen - Called when connection is established
 * @param {Function} handlers.onMessage - Called when message is received
 * @param {Function} handlers.onError - Called when an error occurs
 * @param {Function} handlers.onClose - Called when connection is closed
 */
export const setupSocketHandlers = (socket, handlers) => {
  const { onOpen, onMessage, onError, onClose } = handlers;

  socket.onopen = (e) => {
    console.log('[open] Connection established');
    if (onOpen) onOpen(e);
    
    // Start ping interval to keep connection alive
    startPingInterval(socket);
  };

  socket.onmessage = (event) => {
    // Parse the response
    const data = JSON.parse(event.data);
    console.log(`[message] Data received:`, data);
    
    if (onMessage) onMessage(data, event);
  };

  socket.onerror = (error) => {
    console.log(`[error] ${error.message}`);
    if (onError) onError(error);
  };

  socket.onclose = (event) => {
    if (event.wasClean) {
      console.log(`[close] Connection closed cleanly, code=${event.code} reason=${event.reason}`);
    } else {
      console.log('[close] Connection died');
    }
    
    // Clear ping interval
    if (window.pingIntervalId) {
      clearInterval(window.pingIntervalId);
    }
    
    if (onClose) onClose(event);
  };
};

/**
 * Starts a ping interval to keep the connection alive
 * @param {WebSocket} socket - The WebSocket instance
 * @param {number} interval - Ping interval in milliseconds (default: 30000)
 */
export const startPingInterval = (socket, interval = 30000) => {
  // Clear any existing interval
  if (window.pingIntervalId) {
    clearInterval(window.pingIntervalId);
  }
  
  // Set up new interval
  window.pingIntervalId = setInterval(() => {
    if (socket.readyState === WebSocket.OPEN) {
      console.log('Sending ping to keep connection alive');
      socket.send(JSON.stringify({ ping: 1 }));
    }
  }, interval);
};

/**
 * Sends a request to get tick history
 * @param {WebSocket} socket - The WebSocket instance
 * @param {Object} options - Request options
 * @param {string} options.symbol - Symbol to get history for (default: 'R_50')
 * @param {number} options.count - Number of ticks to get (default: 10)
 */
export const requestTickHistory = (socket, options = {}) => {
  if (!socket || socket.readyState !== WebSocket.OPEN) {
    throw new Error('WebSocket is not connected');
  }
  
  const {
    symbol = 'R_50',
    count = 10
  } = options;
  
  const requestId = Date.now(); // Use timestamp for unique req_id
  
  const request = {
    ticks_history: symbol,
    adjust_start_time: 1,
    count: count,
    end: 'latest',
    start: 1,
    style: 'ticks',
    req_id: requestId
  };
  
  console.log('Sending tick history request:', request);
  socket.send(JSON.stringify(request));
};

/**
 * Safely closes the WebSocket connection
 * @param {WebSocket} socket - The WebSocket instance
 */
export const closeSocket = (socket) => {
  if (socket && socket.readyState === WebSocket.OPEN) {
    socket.close();
  }
  
  // Clear ping interval
  if (window.pingIntervalId) {
    clearInterval(window.pingIntervalId);
  }
};

// Export app IDs for reuse
export { APP_IDS };