import { Logger } from './dummy.js';
import { POVManager } from './pov.manager.js';

export const UI = {
    initTabs() {
        const navItems = document.querySelectorAll('.nav-item');
        const tabContents = document.querySelectorAll('.tab-content');
        const pageTitle = document.getElementById('page-title');

        navItems.forEach(item => {
            item.addEventListener('click', () => {
                const tabId = item.getAttribute('data-tab');
                const title = item.getAttribute('data-title');

                navItems.forEach(nav => nav.classList.remove('active'));
                item.classList.add('active');

                tabContents.forEach(content => content.classList.remove('active'));
                document.getElementById(tabId).classList.add('active');

                pageTitle.textContent = title;
                Logger.log(`Switched to tab: ${title}`);
            });
        });
    },

    setScanningState(isScanning) {
        const btnScan = document.getElementById('btn-scan');
        const icon = btnScan.querySelector('i');
        if (isScanning) {
            icon.classList.add('scanning-loader');
        } else {
            icon.classList.remove('scanning-loader');
        }
    },

    renderDeviceList(devices, onSelect, onConfig) {
        const deviceList = document.getElementById('device-list');
        deviceList.innerHTML = '';
        
        if (devices.length === 0) {
            deviceList.innerHTML = '<div class="status-msg">Устройства не найдены</div>';
            return;
        }

        devices.forEach(dev => {
            const div = document.createElement('div');
            div.className = 'device-card';
            const isSetup = dev.is_setup || false;
            const modeName = isSetup ? 'SETUP' : this.getModeName(dev.mode);
            
            div.innerHTML = `
                <div class="device-row">
                    <div class="device-info">
                        <i class="fa-solid fa-server"></i>
                        <span>${dev.hostname || 'Unknown'}</span>
                    </div>
                    <div class="device-mode ${isSetup ? 'setup-mode' : ''}">${modeName}</div>
                </div>
                <div class="device-ip">
                    <i class="fa-solid fa-sitemap"></i>
                    <span> ${dev.ip}</span>
                </div>
                <div class="device-row" style="justify-content: space-between; align-items: center;">
                    <div class="selection-group">
                        <input type="checkbox" class="device-selector" data-ip="${dev.ip}" ${POVManager && POVManager.masterIp === dev.ip ? 'checked' : ''}>
                        <label>Выбрать</label>
                    </div>
                    <button class="icon-btn-small btn-config" data-ip="${dev.ip}" data-hostname="${dev.hostname || 'Unknown'}">
                        <i class="fa-solid fa-gears"></i>
                    </button>
                </div>
            `;
            
            // Whole card click for connection (optional, keeping for backward compatibility)
            div.addEventListener('click', (e) => {
                if (e.target.closest('.btn-config') || e.target.closest('.device-selector')) return;
                onSelect(dev.ip);
            });

            // Selector change
            const selector = div.querySelector('.device-selector');
            selector.addEventListener('change', (e) => {
                if (e.target.checked) {
                    // Uncheck others
                    document.querySelectorAll('.device-selector').forEach(cb => {
                        if (cb !== e.target) cb.checked = false;
                    });
                    onSelect(dev.ip);
                } else {
                    onSelect(null);
                }
            });

            // Config button click
            const btnConfig = div.querySelector('.btn-config');
            btnConfig.addEventListener('click', () => {
                onConfig(dev.ip, dev.hostname || 'Unknown');
            });

            deviceList.appendChild(div);
        });
    },

    switchToTab(tabId, title) {
        const navItems = document.querySelectorAll('.nav-item');
        const tabContents = document.querySelectorAll('.tab-content');
        const pageTitle = document.getElementById('page-title');

        navItems.forEach(nav => nav.classList.remove('active'));
        const activeNav = Array.from(navItems).find(nav => nav.getAttribute('data-tab') === tabId);
        if (activeNav) activeNav.classList.add('active');

        tabContents.forEach(content => content.classList.remove('active'));
        const targetTab = document.getElementById(tabId);
        if (targetTab) targetTab.classList.add('active');

        pageTitle.textContent = title;
    },

    initDeviceIdOptions() {
        const selects = ['device_id_master', 'device_id_client'];
        selects.forEach(id => {
            const select = document.getElementById(id);
            if (!select) return;
            select.innerHTML = '';
            for (let i = 0; i <= 16; i++) {
                const opt = document.createElement('option');
                opt.value = i;
                opt.textContent = i;
                select.appendChild(opt);
            }
        });
    },

    updateModeForm(mode) {
        const masterSettings = document.getElementById('master-settings');
        const clientSettings = document.getElementById('client-settings');
        
        masterSettings.style.display = 'none';
        clientSettings.style.display = 'none';

        if (mode == 1) { // MASTER
            masterSettings.style.display = 'block';
        } else if (mode == 2) { // CLIENT
            clientSettings.style.display = 'block';
        }
    },

    updateDhcpForm(isDhcp) {
        const staticIpSettings = document.getElementById('static-ip-settings');
        staticIpSettings.style.display = isDhcp ? 'none' : 'block';
    },

    populateDeviceSettings(settings, hostname) {
        if (!settings || !settings.wifi) return;
        const wifi = settings.wifi;
        const leds = settings.leds || {};

        document.getElementById('config-mode').value = wifi.mode;
        this.updateModeForm(wifi.mode);

        // Master settings population
        document.getElementById('sta_ssid').value = wifi.sta_ssid || '';
        document.getElementById('sta_pass').value = wifi.sta_pass || '';
        document.getElementById('sta_timeout_master').value = wifi.sta_timeout || 120;
        document.getElementById('sta_dhcp').checked = wifi.sta_dhcp;
        this.updateDhcpForm(wifi.sta_dhcp);
        
        if (wifi.sta_ip) document.getElementById('sta_ip').value = wifi.sta_ip.join('.');
        if (wifi.sta_gateway) document.getElementById('sta_gateway').value = wifi.sta_gateway.join('.');
        if (wifi.sta_mask) document.getElementById('sta_mask').value = wifi.sta_mask.join('.');
        
        document.getElementById('device_id_master').value = wifi.id || 0;
        document.getElementById('master_hostname_display').value = hostname;
        document.getElementById('count_pixel_master').value = leds.count_pixel || 32;

        // Client settings population
        document.getElementById('client_master_ssid').value = wifi.sta_ssid || '';
        document.getElementById('device_id_client').value = wifi.id || 0;
        document.getElementById('sta_timeout_client').value = wifi.sta_timeout || 120;
        document.getElementById('count_pixel_client').value = leds.count_pixel || 32;
    },

    getSettingsFromForm() {
        const mode = parseInt(document.getElementById('config-mode').value);
        const settings = {
            wifi: {
                mode: mode
            },
            leds: {}
        };

        if (mode === 1) { // MASTER
            settings.wifi.sta_ssid = document.getElementById('sta_ssid').value;
            settings.wifi.sta_pass = document.getElementById('sta_pass').value;
            settings.wifi.sta_timeout = parseInt(document.getElementById('sta_timeout_master').value);
            settings.wifi.sta_dhcp = document.getElementById('sta_dhcp').checked;
            if (!settings.wifi.sta_dhcp) {
                settings.wifi.sta_ip = document.getElementById('sta_ip').value.split('.').map(Number);
                settings.wifi.sta_gateway = document.getElementById('sta_gateway').value.split('.').map(Number);
                settings.wifi.sta_mask = document.getElementById('sta_mask').value.split('.').map(Number);
            }
            settings.wifi.id = parseInt(document.getElementById('device_id_master').value);
            settings.leds.count_pixel = parseInt(document.getElementById('count_pixel_master').value);
        } else if (mode === 2) { // CLIENT
            settings.wifi.sta_ssid = document.getElementById('client_master_ssid').value;
            settings.wifi.sta_pass = "12345678"; // Default per requirement
            settings.wifi.id = parseInt(document.getElementById('device_id_client').value);
            settings.wifi.sta_timeout = parseInt(document.getElementById('sta_timeout_client').value);
            settings.leds.count_pixel = parseInt(document.getElementById('count_pixel_client').value);
        }

        return settings;
    },

    getModeName(mode) {
        const modes = {
            0: 'UNDEFINED',
            1: 'MASTER',
            2: 'CLIENT',
            3: 'AP'
        };
        return modes[mode] || String(mode);
    },

    setStatus(msg) {
        const deviceList = document.getElementById('device-list');
        deviceList.innerHTML = `<div class="status-msg">${msg}</div>`;
    }
};
