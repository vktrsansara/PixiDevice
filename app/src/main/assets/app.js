import { Logger } from './modules/dummy.js';
import { UI } from './modules/ui.js';
import { Connect } from './modules/connect.js';
import { DeviceConfig } from './modules/device.config.js';

document.addEventListener('DOMContentLoaded', () => {
    Logger.log('App Initializing...');

    // Initialize UI
    UI.initTabs();
    UI.initDeviceIdOptions();
    DeviceConfig.init();

    // --- Discovery Logic ---
    const startScan = () => {
        Logger.log('Starting device discovery...');
        UI.setStatus('Поиск устройств в сети...');
        UI.setScanningState(true);
        Connect.startDiscovery();

        // Auto-stop scanning after 10 seconds
        setTimeout(() => {
            Connect.stopDiscovery();
            UI.setScanningState(false);
        }, 10000);
    };

    // Initialize Connection / Discovery
    const btnScan = document.getElementById('btn-scan');
    if (btnScan) {
        btnScan.addEventListener('click', () => {
            Logger.log('Scan button clicked');
            startScan();
        });
    }

    // Handle discovered devices
    Connect.onDevicesUpdate((devices) => {
        UI.renderDeviceList(devices, 
            (ip) => {
                Logger.log(`Selected device: ${ip}`);
                // Future: Connect to specific device
            },
            (ip, hostname) => {
                DeviceConfig.handleConfig(ip, hostname);
            }
        );
    });

    // Auto-scan on startup
    startScan();

    Logger.log('App Ready');
});
