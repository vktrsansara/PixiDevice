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
                let info = null;
                let fsInfo = null;
                
                try {
                    // Start both fetches concurrently
                    const [infoResponse, fsResponse] = await Promise.allSettled([
                        fetch(`http://${device.ip}/`, { signal: AbortSignal.timeout(3000) }),
                        fetch(`http://${device.ip}/status`, { signal: AbortSignal.timeout(3000) })
                    ]);
                    
                    if (infoResponse.status === 'fulfilled' && infoResponse.value.ok) {
                        info = await infoResponse.value.json();
                    }
                    if (fsResponse.status === 'fulfilled' && fsResponse.value.ok) {
                        fsInfo = await fsResponse.value.json();
                    }
                } catch (err) {
                    Logger.error(`Error fetching device stats for ${device.ip}: ${err}`);
                }
                
                this.discoveredDevices.push({
                    ip: device.ip,
                    name: device.name,
                    hostname: info ? info.hostname : device.name,
                    mode: info ? info.mode : '?',
                    is_setup: info ? info.is_setup : false,
                    fsTotal: fsInfo ? fsInfo.totalBytes : 0,
                    fsUsed: fsInfo ? fsInfo.usedBytes : 0
                });
            }
            callback(this.discoveredDevices);
        });
    }
};
