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

    // Handle device download button
    window.addEventListener('device:download', async (e) => {
        const { ip } = e.detail;
        Logger.log(`Download requested for ${ip}`);
        
        try {
            // Fetch current LED count from device
            const response = await fetch(`http://${ip}/get_settings`);
            const settings = await response.json();
            const ledCount = (settings.leds && settings.leds.count_pixel) || 32;
            
            if (window.AndroidImage) {
                window.AndroidImage.pickImages(ip, ledCount);
            } else {
                Logger.error('AndroidImage interface not available');
            }
        } catch (err) {
            Logger.error(`Failed to fetch device settings before upload: ${err}`);
        }
    });

    // Handle upload progress from Java
    window.addEventListener('upload:progress', (e) => {
        const percent = e.detail;
        const progressBar = document.getElementById('upload-progress-bar');
        if (progressBar) {
            progressBar.style.width = `${percent}%`;
            if (percent >= 100 || percent <= 0) {
                setTimeout(() => { progressBar.style.width = '0%'; }, 2000);
            }
        }
    });

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
