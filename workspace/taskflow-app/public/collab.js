// Real-time collaborative editing indicators
class CollaborativeEditor {
  constructor(ws, userId, username) {
    this.ws = ws;
    this.userId = userId;
    this.username = username;
    this.cursors = new Map();
    this.initEventListeners();
  }

  initEventListeners() {
    // Track cursor/selection changes
    document.addEventListener('selectionchange', () => {
      const selection = window.getSelection();
      if (selection.rangeCount > 0) {
        const range = selection.getRangeAt(0);
        const rect = range.getBoundingClientRect();

        this.ws.send(JSON.stringify({
          type: 'cursor_update',
          userId: this.userId,
          username: this.username,
          position: {
            x: rect.left + window.scrollX,
            y: rect.top + window.scrollY,
            width: rect.width,
            height: rect.height
          }
        }));
      }
    });

    // Handle incoming cursor updates
    this.ws.addEventListener('message', (event) => {
      const data = JSON.parse(event.data);
      if (data.type === 'cursor_update') {
        this.updateCursor(data);
      }
    });
  }

  updateCursor(data) {
    let cursor = this.cursors.get(data.userId);
    if (!cursor) {
      cursor = document.createElement('div');
      cursor.className = 'collab-cursor';
      cursor.style.position = 'absolute';
      cursor.style.pointerEvents = 'none';
      cursor.style.zIndex = '1000';
      cursor.innerHTML = `<div class="cursor-label">${data.username}</div>`;
      document.body.appendChild(cursor);
      this.cursors.set(data.userId, cursor);
    }

    cursor.style.left = `${data.position.x}px`;
    cursor.style.top = `${data.position.y}px`;
    cursor.style.width = `${data.position.width}px`;
    cursor.style.height = `${data.position.height}px`;
  }

  cleanup() {
    this.cursors.forEach(cursor => cursor.remove());
    this.cursors.clear();
  }
}

// Initialize when WebSocket connects
function initCollaboration(ws) {
  // Generate random user ID and name for demo
  const userId = 'user-' + Math.random().toString(36).substr(2, 9);
  const username = `User-${Math.floor(Math.random() * 100)}`;

  return new CollaborativeEditor(ws, userId, username);
}