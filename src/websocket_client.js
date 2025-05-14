const app_id = 75914; // Replace with your app_id.
const socket = new WebSocket(`wss://ws.derivws.com/websockets/v3?app_id=${app_id}`); // Create a new WebSocket connection using the app_id

// Event handler for when the WebSocket connection is opened
socket.onopen = function (e) {
  console.log('[open] Connection established'); // Log connection establishment
  console.log('Sending to server');

  const sendMessage = JSON.stringify({ ping: 1 }); // Create a ping message in JSON format
  socket.send(sendMessage); // Send the ping message to the server
};

// Event handler for when a message is received from the server
socket.onmessage = function (event) {
  console.log(`[message] Data received from server: ${event.data}`); // Log the message received from the server
};

// Event handler for when the WebSocket connection is closed
socket.onclose = function (event) {
  if (event.wasClean) {
    console.log(`[close] Connection closed cleanly, code=${event.code} reason=${event.reason}`); // Log clean close with code and reason
  } else {
    console.log('[close] Connection died'); // Log an abrupt close
  }
};

// Event handler for when an error occurs with the WebSocket connection
socket.onerror = function (error) {
  console.log(`[error] ${error.message}`); // Log the error that occurred
};

/*
Instructions to run this code:

1. Ensure Node.js is installed on your machine. You can download it from https://nodejs.org/.
2. Install the `ws` WebSocket library by running:
   npm install ws
3. Save this code to a file, e.g., `websocket_client.js`.
4. Open a terminal and navigate to the directory where you saved the file.
5. Run the code using the following command:
   node websocket_client.js

Ensure that the `app_id` in the URL is replaced with your own if needed.
*/