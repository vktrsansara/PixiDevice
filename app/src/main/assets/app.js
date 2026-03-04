import { Logger } from './modules/dummy.js';
import { UI } from './modules/ui.js';
import { Connect } from './modules/connect.js';

document.addEventListener('DOMContentLoaded', () => {
    Logger.log('App Initializing...');

    // Initialize UI
    UI.initTabs();
    UI.initDeviceIdOptions();

    let currentConfigIp = null;

    // --- Form Event Listeners ---
    const configMode = document.getElementById('config-mode');
    if (configMode) {
        configMode.addEventListener('change', (e) => {
            UI.updateModeForm(e.target.value);
        });
    }

    const staDhcp = document.getElementById('sta_dhcp');
    if (staDhcp) {
        staDhcp.addEventListener('change', (e) => {
            UI.updateDhcpForm(e.target.checked);
        });
    }

    // --- Copy Button ---
    const btnCopy = document.getElementById('btn-copy-hostname');
    if (btnCopy) {
        btnCopy.addEventListener('click', () => {
            const hostname = document.getElementById('master_hostname_display').value;
            navigator.clipboard.writeText(hostname).then(() => {
                Logger.log(`Copied hostname: ${hostname}`);
            }).catch(err => {
                Logger.log(`Failed to copy: ${err}`);
            });
        });
    }

    // --- Save Button ---
    const btnSave = document.getElementById('btn-save-settings');
    if (btnSave) {
        btnSave.addEventListener('click', async () => {
            if (!currentConfigIp) return;

            const settings = UI.getSettingsFromForm();
            
            // Validation
            let isValid = true;
            
            if (settings.wifi.mode === 1) { // MASTER
                if (!settings.wifi.sta_dhcp) {
                    const ipFields = ['sta_ip', 'sta_gateway', 'sta_mask'];
                    ipFields.forEach(id => {
                        const input = document.getElementById(id);
                        if (!validateIP(input.value)) {
                            input.classList.add('invalid');
                            isValid = false;
                        } else {
                            input.classList.remove('invalid');
                        }
                    });
                }
                
                const ledInput = document.getElementById('count_pixel_master');
                if (!validateLeds(ledInput.value)) {
                    ledInput.classList.add('invalid');
                    isValid = false;
                } else {
                    ledInput.classList.remove('invalid');
                }
            } else if (settings.wifi.mode === 2) { // CLIENT
                const ledInput = document.getElementById('count_pixel_client');
                if (!validateLeds(ledInput.value)) {
                    ledInput.classList.add('invalid');
                    isValid = false;
                } else {
                    ledInput.classList.remove('invalid');
                }
            }

            if (!isValid) {
                Logger.log('Validation failed');
                return;
            }

            try {
                Logger.log(`Saving settings to ${currentConfigIp}...`);
                const response = await fetch(`http://${currentConfigIp}/set_settings`, {
                    method: 'POST',
                    headers: { 'Content-Type': 'application/json' },
                    body: JSON.stringify(settings)
                });
                
                if (response.ok) {
                    Logger.log('Settings saved successfully');
                    alert('Настройки сохранены');
                    UI.switchToTab('tab-connection', 'Подключение');
                } else {
                    Logger.log(`Save failed with status: ${response.status}`);
                }
            } catch (err) {
                Logger.log(`Save error: ${err}`);
            }
        });
    }

    // --- Validation Helpers ---
    function validateIP(ip) {
        const ipRegex = /^(25[0-5]|2[0-4][0-9]|[01]?[0-9][0-9]?)\.(25[0-5]|2[0-4][0-9]|[01]?[0-9][0-9]?)\.(25[0-5]|2[0-4][0-9]|[01]?[0-9][0-9]?)\.(25[0-5]|2[0-4][0-9]|[01]?[0-9][0-9]?)$/;
        return ipRegex.test(ip);
    }

    function validateLeds(count) {
        const val = parseInt(count);
        return !isNaN(val) && val >= 1 && val <= 512;
    }

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
        UI.renderDeviceList(devices, 
            (ip) => {
                Logger.log(`Selected device: ${ip}`);
                // Future: Connect to specific device
            },
            async (ip, hostname) => {
                Logger.log(`Configuring device: ${ip}`);
                currentConfigIp = ip;
                
                // Fetch settings
                try {
                    UI.setStatus(`Получение настроек ${hostname}...`);
                    const response = await fetch(`http://${ip}/get_settings`);
                    if (response.ok) {
                        const settings = await response.json();
                        UI.populateDeviceSettings(settings, hostname);
                        UI.switchToTab('tab-device-config', hostname);
                    } else {
                        Logger.log(`Failed to fetch settings: ${response.status}`);
                    }
                } catch (err) {
                    Logger.log(`Fetch settings error: ${err}`);
                }
            }
        );
    });

    Logger.log('App Ready');
});
