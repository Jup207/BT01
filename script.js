// Web Bluetooth API Logic for BLE Terminal
const connectBtn = document.getElementById('connect-btn');
const disconnectBtn = document.getElementById('disconnect-btn');
const statusIndicator = document.getElementById('status-indicator');
const terminal = document.getElementById('terminal');
const sendForm = document.getElementById('send-form');
const inputMsg = document.getElementById('input-msg');
const sendBtn = document.getElementById('send-btn');
const clearBtn = document.getElementById('clear-btn');
const macroOnBtn = document.getElementById('macro-on-btn');
const macroOffBtn = document.getElementById('macro-off-btn');

let bluetoothDevice = null;
let txCharacteristic = null;
let rxCharacteristic = null;

// HM-10 (CC2541) typically uses FFE0 / FFE1
const SERVICE_UUID_HM10 = 0xFFE0;
const CHARACTERISTIC_UUID_HM10 = 0xFFE1;

function addLog(message, type = 'info') {
    const row = document.createElement('div');
    row.className = `msg-row msg-${type}`;
    
    const time = document.createElement('span');
    time.className = 'msg-time';
    const now = new Date();
    time.textContent = `[${now.getHours().toString().padStart(2, '0')}:${now.getMinutes().toString().padStart(2, '0')}:${now.getSeconds().toString().padStart(2, '0')}]`;
    
    const content = document.createElement('span');
    content.className = 'msg-content';
    content.textContent = message;
    
    row.appendChild(time);
    row.appendChild(content);
    terminal.appendChild(row);
    
    terminal.scrollTop = terminal.scrollHeight;
}

async function connect() {
    try {
        if (!navigator.bluetooth) {
            addLog("Web Bluetooth API is not available in this browser.", 'info');
            return;
        }

        addLog("Requesting HM-10 Bluetooth Device...", 'info');
        
        bluetoothDevice = await navigator.bluetooth.requestDevice({
            filters: [{ services: [SERVICE_UUID_HM10] }],
            optionalServices: [SERVICE_UUID_HM10]
        });

        bluetoothDevice.addEventListener('gattserverdisconnected', onDisconnected);

        addLog(`Connecting to GATT Server of ${bluetoothDevice.name || 'Unknown Device'}...`, 'info');
        const server = await bluetoothDevice.gatt.connect();

        addLog("Getting HM-10 Service...", 'info');
        const service = await server.getPrimaryService(SERVICE_UUID_HM10);
        
        addLog("Getting Characteristic...", 'info');
        const characteristic = await service.getCharacteristic(CHARACTERISTIC_UUID_HM10);
        txCharacteristic = characteristic;
        rxCharacteristic = characteristic;

        await rxCharacteristic.startNotifications();
        rxCharacteristic.addEventListener('characteristicvaluechanged', handleNotifications);
        addLog("Notifications started. Ready to communicate.", 'success');
        
        updateUIConnected(true);
    } catch (error) {
        addLog("Connection failed: " + error.message, 'info');
        console.error(error);
        updateUIConnected(false);
    }
}

function onDisconnected() {
    addLog(`Device disconnected.`, 'info');
    updateUIConnected(false);
}

async function disconnect() {
    if (!bluetoothDevice) return;
    addLog("Disconnecting...", 'info');
    if (bluetoothDevice.gatt.connected) {
        bluetoothDevice.gatt.disconnect();
    }
}

function handleNotifications(event) {
    const value = event.target.value;
    const decoder = new TextDecoder('utf-8');
    const text = decoder.decode(value);
    addLog(text.trim(), 'rx');
}

async function sendData(msg) {
    if (!msg || !txCharacteristic) return;
    
    try {
        const encoder = new TextEncoder('utf-8');
        // Arduino usually reads until newline
        const data = encoder.encode(msg + '\n');
        
        if (data.length <= 20) {
            await txCharacteristic.writeValue(data);
        } else {
            for (let i = 0; i < data.length; i += 20) {
                const chunk = data.slice(i, i + 20);
                await txCharacteristic.writeValue(chunk);
            }
        }
        
        addLog(msg, 'tx');
    } catch (error) {
        addLog("Send error: " + error.message, 'info');
    }
}

sendForm.addEventListener('submit', (e) => {
    e.preventDefault();
    sendData(inputMsg.value);
    inputMsg.value = '';
});

macroOnBtn.addEventListener('click', () => sendData('1'));
macroOffBtn.addEventListener('click', () => sendData('0'));

function updateUIConnected(isConnected) {
    if (isConnected) {
        statusIndicator.textContent = 'Connected';
        statusIndicator.className = 'status connected';
        connectBtn.style.display = 'none';
        disconnectBtn.style.display = 'inline-block';
        inputMsg.disabled = false;
        sendBtn.disabled = false;
        macroOnBtn.disabled = false;
        macroOffBtn.disabled = false;
        inputMsg.focus();
    } else {
        statusIndicator.textContent = 'Disconnected';
        statusIndicator.className = 'status disconnected';
        connectBtn.style.display = 'inline-block';
        disconnectBtn.style.display = 'none';
        inputMsg.disabled = true;
        sendBtn.disabled = true;
        macroOnBtn.disabled = true;
        macroOffBtn.disabled = true;
        txCharacteristic = null;
        rxCharacteristic = null;
    }
}

connectBtn.addEventListener('click', connect);
disconnectBtn.addEventListener('click', disconnect);
clearBtn.addEventListener('click', () => { terminal.innerHTML = ''; });
