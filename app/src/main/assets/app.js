import { Logger } from './modules/dummy.js';
import { UI } from './modules/ui.js';
import { Connect } from './modules/connect.js';
import { DeviceConfig } from './modules/device.config.js';
import { POVManager } from './modules/pov.manager.js';
import { CustomSelect } from './modules/custom.select.js';

document.addEventListener('DOMContentLoaded', () => {
    Logger.log('App Initializing...');

    // Initialize UI
    UI.initTabs();
    UI.initDeviceIdOptions();
    DeviceConfig.init();
    POVManager.init();
    CustomSelect.init();

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
                if (ip) {
                    Logger.log(`Selected device: ${ip}`);
                    POVManager.setMasterIp(ip);
                    // POV gallery will load when user switches to tab or if already there
                    POVManager.loadGallery();
                } else {
                    Logger.log('Device unselected');
                    POVManager.setMasterIp(null);
                }
            },
            (ip, hostname) => {
                DeviceConfig.handleConfig(ip, hostname);
            }
        );
    });

    // Handle Tab Changes for POV Loading
    document.querySelectorAll('.nav-item').forEach(item => {
        item.addEventListener('click', () => {
            if (item.getAttribute('data-tab') === 'tab-pov') {
                POVManager.loadGallery();
            }
        });
    });

    // Auto-scan on startup
    startScan();

    Logger.log('App Ready');
});
