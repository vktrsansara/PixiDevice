import { Logger } from './dummy.js';

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

    renderDeviceList(devices, onSelect) {
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
                    <span>${dev.ip}</span>
                </div>
            `;
            div.addEventListener('click', () => onSelect(dev.ip));
            deviceList.appendChild(div);
        });
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
