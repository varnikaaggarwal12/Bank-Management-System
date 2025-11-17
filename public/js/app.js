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
  socket.on('connect', () => events.textContent += `Connected ${socket.id}\n`);
  socket.on('transactionUpdate', (data) => events.textContent += `TxUpdate: ${JSON.stringify(data)}\n`);
  socket.on('transactionEvent', (data) => events.textContent += `Event: ${JSON.stringify(data)}\n`);
}

function joinRoom() {
  if (!token) return alert('Login first');
  const payload = JSON.parse(atob(token.split('.')[1]));
  const accountNumber = payload.accountNumber;
  socket.emit('joinAccount', accountNumber);
  alert('Joined room for account: '+accountNumber);
}
