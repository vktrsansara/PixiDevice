import { Logger } from './modules/dummy.js';

document.addEventListener('DOMContentLoaded', () => {
    Logger.log('App initialized');
    
    const navItems = document.querySelectorAll('.nav-item');
    const tabContents = document.querySelectorAll('.tab-content');
    const pageTitle = document.getElementById('page-title');
    const deviceList = document.getElementById('device-list');
    const btnScan = document.getElementById('btn-scan');

    // Tab switching
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

    // Discovery Logic
    if (window.AndroidDiscovery) {
        btnScan.addEventListener('click', () => {
            Logger.log('Scanning for devices...');
            deviceList.innerHTML = '<div class="status-msg">Поиск устройств в сети...</div>';
            btnScan.querySelector('i').classList.add('scanning-loader');
            window.AndroidDiscovery.startDiscovery();
            
            // Auto-stop after 10 seconds
            setTimeout(() => {
                window.AndroidDiscovery.stopDiscovery();
                btnScan.querySelector('i').classList.remove('scanning-loader');
            }, 10000);
        });

        window.addEventListener('nsd:onDevicesFound', async (event) => {
            const devices = event.detail || [];
            if (devices.length === 0) return;

            deviceList.innerHTML = '';
            for (const device of devices) {
                try {
                    // Fetch full info from the device API
                    const response = await fetch(`http://${device.ip}/`, { signal: AbortSignal.timeout(3000) });
                    const info = await response.json();
                    
                    renderDevice(info, device.ip);
                } catch (err) {
                    Logger.error(`Failed to get info for ${device.ip}: ${err}`);
                    // Fallback render with minimal info
                    renderDevice({ hostname: device.name, mode: '?' }, device.ip);
                }
            }
        });
    } else {
        Logger.error('AndroidDiscovery interface not found');
        deviceList.innerHTML = '<div class="status-msg error">Ошибка: Интерфейс поиска не найден.</div>';
    }

    function renderDevice(info, ip) {
        const div = document.createElement('div');
        div.className = 'device-card';
        const isSetup = info.is_setup || false;
        const modeName = isSetup ? 'SETUP' : getModeName(info.mode);
        
        div.innerHTML = `
            <div class="device-row">
                <div class="device-info">
                    <i class="fa-solid fa-server"></i>
                    <span>${info.hostname || 'Unknown'}</span>
                </div>
                <div class="device-mode ${isSetup ? 'setup-mode' : ''}">${modeName}</div>
            </div>
            <div class="device-ip">
                <i class="fa-solid fa-sitemap"></i>
                <span>${ip}</span>
            </div>
        `;
        div.addEventListener('click', () => selectDevice(ip));
        deviceList.appendChild(div);
    }

    function getModeName(mode) {
        const modes = {
            0: 'UNDEFINED',
            1: 'MASTER',
            2: 'CLIENT',
            3: 'AP'
        };
        return modes[mode] || String(mode);
    }

    function selectDevice(ip) {
        Logger.log(`Selected device: ${ip}`);
        // TODO: Store selected device and switch to POV or Player
    }
});
