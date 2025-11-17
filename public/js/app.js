// public/js/app.js
let token = '';
let socket;

const API = '/api/accounts';

async function openAccount() {
  const name = document.getElementById('name').value;
  const pin = document.getElementById('pin').value;
  const res = await fetch(`${API}/open`, { method: 'POST', headers: {'Content-Type':'application/json'}, body: JSON.stringify({ name, pin }) });
  const data = await res.json();
  alert(JSON.stringify(data));
}

async function login() {
  const accountNumber = document.getElementById('loginAcc').value;
  const pin = document.getElementById('loginPin').value;
  const res = await fetch(`${API}/login`, { method: 'POST', headers: {'Content-Type':'application/json'}, body: JSON.stringify({ accountNumber, pin }) });
  const data = await res.json();
  if (res.ok) {
    token = data.token;
    alert('Logged in');
  } else alert(data.message || JSON.stringify(data));
}

async function deposit() {
  if (!token) return alert('Login first');
  const amount = document.getElementById('amount').value;
  const res = await fetch(`${API}/deposit`, { method: 'POST', headers: { 'Content-Type':'application/json', 'Authorization':'Bearer '+token }, body: JSON.stringify({ amount }) });
  const data = await res.json();
  alert(JSON.stringify(data));
}

async function withdraw() {
  if (!token) return alert('Login first');
  const amount = document.getElementById('amount').value;
  const res = await fetch(`${API}/withdraw`, { method: 'POST', headers: { 'Content-Type':'application/json', 'Authorization':'Bearer '+token }, body: JSON.stringify({ amount }) });
  const data = await res.json();
  alert(JSON.stringify(data));
}

async function transfer() {
  if (!token) return alert('Login first');
  const toAccountNumber = document.getElementById('toAcc').value;
  const amount = document.getElementById('amount').value;
  const res = await fetch(`${API}/transfer`, { method: 'POST', headers: { 'Content-Type':'application/json', 'Authorization':'Bearer '+token }, body: JSON.stringify({ toAccountNumber, amount }) });
  const data = await res.json();
  alert(JSON.stringify(data));
}

async function getHistory() {
  if (!token) return alert('Login first');
  const res = await fetch('/api/transactions', { headers: { 'Authorization': 'Bearer '+token } });
  const data = await res.json();
  const list = document.getElementById('history');
  list.innerHTML = '';
  data.forEach(t => { const li = document.createElement('li'); li.textContent = `${new Date(t.date).toLocaleString()} - ${t.type} - ${t.amount} ${t.toAccount? '-> '+t.toAccount : ''}`; list.appendChild(li); });
}

function connectSocket() {
  socket = io();
  const events = document.getElementById('events');
  const queueStats = document.getElementById('queueStats');
  
  socket.on('connect', () => {
    events.textContent += `Connected ${socket.id}\n`;
    // Request initial queue stats
    socket.emit('getQueueStats');
  });
  
  socket.on('transactionUpdate', (data) => events.textContent += `📊 TxUpdate: ${JSON.stringify(data)}\n`);
  socket.on('transactionEvent', (data) => events.textContent += `🔄 Event: ${JSON.stringify(data)}\n`);
  socket.on('accountEvent', (data) => events.textContent += `👤 Account: ${JSON.stringify(data)}\n`);
  socket.on('notification', (data) => events.textContent += `🔔 Notification: ${JSON.stringify(data)}\n`);
  
  socket.on('queueStats', (stats) => {
    queueStats.innerHTML = '<h3>📈 Queue Statistics</h3>';
    Object.entries(stats).forEach(([queueName, stat]) => {
      queueStats.innerHTML += `
        <div>
          <strong>${queueName}:</strong> 
          Waiting: ${stat.waiting}, 
          Delayed: ${stat.delayed}, 
          Failed: ${stat.failed}
        </div>
      `;
    });
  });
  
  // Auto-refresh queue stats every 10 seconds
  setInterval(() => {
    if (socket && socket.connected) {
      socket.emit('getQueueStats');
    }
  }, 10000);
}

function joinRoom() {
  if (!token) return alert('Login first');
  const payload = JSON.parse(atob(token.split('.')[1]));
  const accountNumber = payload.accountNumber;
  socket.emit('joinAccount', accountNumber);
  alert('Joined room for account: '+accountNumber);
}

async function testPubSub() {
  try {
    const response = await fetch('/api/queues/publish/notificationEvents', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        data: {
          type: 'test_notification',
          message: 'This is a test notification',
          timestamp: new Date().toISOString()
        }
      })
    });
    const result = await response.json();
    alert('Test message published: ' + JSON.stringify(result));
  } catch (err) {
    alert('Error testing pub/sub: ' + err.message);
  }
}

async function testQueue() {
  try {
    const response = await fetch('/api/queues/enqueue/emailQueue', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        jobData: {
          type: 'test_email',
          recipient: 'test@example.com',
          subject: 'Test Email from Queue System'
        }
      })
    });
    const result = await response.json();
    alert('Test job enqueued: ' + JSON.stringify(result));
  } catch (err) {
    alert('Error testing queue: ' + err.message);
  }
}

async function getQueueHealth() {
  try {
    const response = await fetch('/api/queues/health');
    const health = await response.json();
    alert('Queue Health: ' + JSON.stringify(health, null, 2));
  } catch (err) {
    alert('Error getting queue health: ' + err.message);
  }
}
