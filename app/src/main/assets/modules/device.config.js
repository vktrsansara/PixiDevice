import { Logger } from './dummy.js';
import { UI } from './ui.js';

export const DeviceConfig = {
    currentConfigIp: null,

    init() {
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

        const btnCancel = document.getElementById('btn-cancel-settings');
        if (btnCancel) {
            btnCancel.addEventListener('click', () => {
                this.close();
            });
        }

        const btnSave = document.getElementById('btn-save-settings');
        if (btnSave) {
            btnSave.addEventListener('click', () => this.saveSettings());
        }
    },

    handleConfig(ip, hostname) {
        this.currentConfigIp = ip;
        this.fetchSettings(ip, hostname);
    },

    async fetchSettings(ip, hostname) {
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
    },

    async saveSettings() {
        if (!this.currentConfigIp) return;

        const settings = UI.getSettingsFromForm();
        
        if (!this.validate(settings)) {
            Logger.log('Validation failed');
            return;
        }

        try {
            Logger.log(`Saving settings to ${this.currentConfigIp}...`);
            const response = await fetch(`http://${this.currentConfigIp}/set_settings`, {
                // Change to actual target IP when testing
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify(settings)
            });
            
            if (response.ok) {
                Logger.log('Settings saved successfully');
                alert('Настройки сохранены');
                this.close();
            } else {
                Logger.log(`Save failed with status: ${response.status}`);
            }
        } catch (err) {
            Logger.log(`Save error: ${err}`);
        }
    },

    validate(settings) {
        let isValid = true;
        
        if (settings.wifi.mode === 1) { // MASTER
            if (!settings.wifi.sta_dhcp) {
                const ipFields = ['sta_ip', 'sta_gateway', 'sta_mask'];
                ipFields.forEach(id => {
                    const input = document.getElementById(id);
                    if (!this.validateIP(input.value)) {
                        input.classList.add('invalid');
                        isValid = false;
                    } else {
                        input.classList.remove('invalid');
                    }
                });
            }
            
            const ledInput = document.getElementById('count_pixel_master');
            if (!this.validateLeds(ledInput.value)) {
                ledInput.classList.add('invalid');
                isValid = false;
            } else {
                ledInput.classList.remove('invalid');
            }
        } else if (settings.wifi.mode === 2) { // CLIENT
            const ledInput = document.getElementById('count_pixel_client');
            if (!this.validateLeds(ledInput.value)) {
                ledInput.classList.add('invalid');
                isValid = false;
            } else {
                ledInput.classList.remove('invalid');
            }
        }
        return isValid;
    },

    validateIP(ip) {
        const ipRegex = /^(25[0-5]|2[0-4][0-9]|[01]?[0-9][0-9]?)\.(25[0-5]|2[0-4][0-9]|[01]?[0-9][0-9]?)\.(25[0-5]|2[0-4][0-9]|[01]?[0-9][0-9]?)\.(25[0-5]|2[0-4][0-9]|[01]?[0-9][0-9]?)$/;
        return ipRegex.test(ip);
    },

    validateLeds(count) {
        const val = parseInt(count);
        return !isNaN(val) && val >= 1 && val <= 512;
    },

    close() {
        UI.switchToTab('tab-connection', 'Подключение');
        this.currentConfigIp = null;
    }
};
