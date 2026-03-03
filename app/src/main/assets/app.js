import { Logger } from './modules/dummy.js';
import { UI } from './modules/ui.js';
import { Connect } from './modules/connect.js';

document.addEventListener('DOMContentLoaded', () => {
    Logger.log('App Initializing...');

    // Initialize UI
    UI.initTabs();

    // Initialize Connection / Discovery
    const btnScan = document.getElementById('btn-scan');
    
    if (btnScan) {
        btnScan.addEventListener('click', () => {
            Logger.log('Scan button clicked');
            UI.setStatus('Поиск устройств в сети...');
            UI.setScanningState(true);
            
            Connect.startDiscovery();

            // Auto-stop scanning after 10 seconds
            setTimeout(() => {
                Connect.stopDiscovery();
                UI.setScanningState(false);
            }, 10000);
        });
    }

    // Handle discovered devices
    Connect.onDevicesUpdate((devices) => {
        UI.renderDeviceList(devices, (ip) => {
            Logger.log(`Selected device: ${ip}`);
            // Future: Connect to specific device
        });
    });

    Logger.log('App Ready');
});
