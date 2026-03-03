import { Logger } from './dummy.js';

export const Connect = {
    discoveredDevices: [],
    
    startDiscovery() {
        if (window.AndroidDiscovery) {
            this.discoveredDevices = [];
            window.AndroidDiscovery.startDiscovery();
        } else {
            Logger.error('AndroidDiscovery not available');
        }
    },

    stopDiscovery() {
        if (window.AndroidDiscovery) {
            window.AndroidDiscovery.stopDiscovery();
        }
    },

    async fetchDeviceInfo(ip) {
        try {
            const response = await fetch(`http://${ip}/`, { signal: AbortSignal.timeout(3000) });
            return await response.json();
        } catch (err) {
            Logger.error(`Fetch failed for ${ip}: ${err}`);
            return null;
        }
    },

    onDevicesUpdate(callback) {
        window.addEventListener('nsd:onDevicesFound', async (event) => {
            const rawDevices = event.detail || [];
            this.discoveredDevices = [];

            for (const device of rawDevices) {
                const info = await this.fetchDeviceInfo(device.ip);
                this.discoveredDevices.push({
                    ip: device.ip,
                    name: device.name,
                    hostname: info ? info.hostname : device.name,
                    mode: info ? info.mode : '?',
                    is_setup: info ? info.is_setup : false
                });
            }
            callback(this.discoveredDevices);
        });
    }
};
