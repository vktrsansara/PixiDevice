import { Logger } from './dummy.js';
import { UI } from './ui.js';

export const POVManager = {
    masterIp: null,
    activeFile: null,
    controls: {
        brightness: 25,
        speed: 100,
        gamma: 2.2
    },
    debounceTimer: null,

    init() {
        Logger.log('POVManager initialized');
        this.initControls();
    },

    initControls() {
        const toggleBtn = document.getElementById('btn-toggle-pov-controls');
        const container = document.getElementById('pov-controls-container');

        if (toggleBtn && container) {
            toggleBtn.addEventListener('click', () => {
                container.classList.toggle('open');
            });
        }

        const sliders = [
            { id: 'pov_brightness', key: 'brightness', suffix: '%' },
            { id: 'pov_speed', key: 'speed', suffix: '%' },
            { id: 'pov_gamma', key: 'gamma', suffix: '' }
        ];

        sliders.forEach(slider => {
            const input = document.getElementById(slider.id);
            const valDisplay = document.getElementById(`${slider.id}_val`);
            
            if (input && valDisplay) {
                input.addEventListener('input', (e) => {
                    valDisplay.textContent = e.target.value + slider.suffix;
                    this.controls[slider.key] = parseFloat(e.target.value);
                    this.scheduleUpdate();
                });
            }
        });
    },

    setMasterIp(ip) {
        this.masterIp = ip;
    },

    async loadGallery() {
        const grid = document.getElementById('pov-grid');
        if (!this.masterIp) {
            grid.innerHTML = '<div class="status-msg">Выберите устройство для загрузки эффектов...</div>';
            return;
        }

        Logger.log(`Loading POV gallery from ${this.masterIp}...`);
        grid.innerHTML = '<div class="status-msg"><i class="fa-solid fa-sync scanning-loader"></i> Загрузка...</div>';

        try {
            const response = await fetch(`http://${this.masterIp}/list`);
            const files = await response.json();
            
            // Filter only BMP files
            const bmpFiles = files.filter(f => f.name.toLowerCase().endsWith('.bmp'));
            
            this.renderGallery(bmpFiles);
        } catch (err) {
            Logger.error(`Failed to load file list: ${err}`);
            grid.innerHTML = '<div class="status-msg">Ошибка загрузки списка файлов</div>';
        }
    },

    renderGallery(files) {
        const grid = document.getElementById('pov-grid');
        grid.innerHTML = '';

        if (files.length === 0) {
            grid.innerHTML = '<div class="status-msg">На устройстве нет BMP файлов</div>';
            return;
        }

        // Setup Selection Mode variables
        this.selectedFiles = new Set();
        this.isSelectionMode = false;
        const deleteBtn = document.getElementById('pov-btn-delete');
        if (deleteBtn) {
            deleteBtn.style.display = 'none';
            // Need to remove old event listeners to prevent duplicates if renderGallery is called multiple times
            const newBtn = deleteBtn.cloneNode(true);
            deleteBtn.parentNode.replaceChild(newBtn, deleteBtn);
            newBtn.addEventListener('click', () => this.deleteSelectedFiles());
        }

        files.forEach(file => {
            const tile = document.createElement('div');
            tile.className = 'pov-tile';
            tile.setAttribute('data-file', file.name);
            if (this.activeFile === file.name) tile.classList.add('playing');

            // Strip leading slash for preview
            const fileName = file.name.startsWith('/') ? file.name.substring(1) : file.name;

            tile.innerHTML = `
                <img src="http://${this.masterIp}/${fileName}" alt="${fileName}" loading="lazy">
                <div class="playing-overlay">
                    <i class="fa-regular fa-circle-play"></i>
                </div>
                <div class="selection-overlay">
                    <i class="fa-solid fa-circle-check"></i>
                </div>
            `;

            let pressTimer = null;
            let isDragging = false;
            
            const handleInteract = () => {
                if (this.isSelectionMode) {
                    this.toggleSelection(file.name, tile);
                } else {
                    this.playAnimation(file.name);
                }
            };

            const startPress = (e) => {
                if (e.type === 'touchstart' && e.touches.length > 1) return;
                isDragging = false;
                pressTimer = setTimeout(() => {
                    if (!isDragging && !this.isSelectionMode) {
                        this.isSelectionMode = true;
                        this.toggleSelection(file.name, tile);
                    }
                }, 500); // 500ms for long press
            };

            const cancelPress = () => {
                if (pressTimer) clearTimeout(pressTimer);
            };

            tile.addEventListener('mousedown', startPress);
            tile.addEventListener('touchstart', startPress, {passive: true});
            
            tile.addEventListener('mousemove', () => isDragging = true);
            tile.addEventListener('touchmove', () => isDragging = true, {passive: true});

            tile.addEventListener('mouseup', cancelPress);
            tile.addEventListener('mouseleave', cancelPress);
            tile.addEventListener('touchend', cancelPress);
            tile.addEventListener('touchcancel', cancelPress);

            tile.addEventListener('click', (e) => {
                cancelPress();
                if (isDragging) return;
                // If it was just a long press that triggered selection mode, 
                // we don't want the click event to immediately toggle it again or play
                // If the click is fired, and we are not in selection mode, play.
                // If we are, but the selection was just established (we can check class), we still need to handle it properly
                // Actually, if long press just activated, the subsequent click usually fires.
                // It's safer to handle the interaction in 'click' rather than touchend to prevent issues
                // Wait, if long press activates, we don't want click to undo it. 
                handleInteract();
            });

            // Prevent default context menu on right click / long press
            tile.addEventListener('contextmenu', e => {
                e.preventDefault();
                cancelPress();
                if (!this.isSelectionMode) {
                    this.isSelectionMode = true;
                    this.toggleSelection(file.name, tile);
                }
            });

            grid.appendChild(tile);
        });
    },

    toggleSelection(fileName, tile) {
        if (this.selectedFiles.has(fileName)) {
            this.selectedFiles.delete(fileName);
            tile.classList.remove('selected');
        } else {
            this.selectedFiles.add(fileName);
            tile.classList.add('selected');
        }

        const deleteBtn = document.getElementById('pov-btn-delete');
        if (this.selectedFiles.size > 0) {
            if (deleteBtn) deleteBtn.style.display = 'flex';
        } else {
            this.isSelectionMode = false;
            if (deleteBtn) deleteBtn.style.display = 'none';
        }
    },

    async showModal(titleStr, messageStr, showCancel = true) {
        return new Promise((resolve) => {
            const overlay = document.getElementById('custom-modal-overlay');
            if (!overlay) {
                if (showCancel) {
                    resolve(confirm(messageStr));
                } else {
                    alert(messageStr);
                    resolve(true);
                }
                return;
            }
            
            const title = document.getElementById('modal-title');
            const msg = document.getElementById('modal-message');
            const btnYes = document.getElementById('modal-btn-yes');
            const btnNo = document.getElementById('modal-btn-no');

            if (title) title.textContent = titleStr;
            if (msg) msg.textContent = messageStr;
            
            if (btnNo) {
                btnNo.style.display = showCancel ? 'block' : 'none';
            }
            
            if (btnYes) {
                btnYes.textContent = showCancel ? 'Да' : 'OK';
            }

            overlay.style.display = 'flex';

            const cleanup = () => {
                overlay.style.display = 'none';
                btnYes.removeEventListener('click', onYes);
                if (btnNo) btnNo.removeEventListener('click', onNo);
            };

            const onYes = () => { cleanup(); resolve(true); };
            const onNo = () => { cleanup(); resolve(false); };

            btnYes.addEventListener('click', onYes);
            if (btnNo) btnNo.addEventListener('click', onNo);
        });
    },

    async deleteSelectedFiles() {
        if (!this.masterIp || this.selectedFiles.size === 0) return;
        
        const confirmed = await this.showModal('Удаление', `Удалить выбранные файлы (${this.selectedFiles.size} шт.)?`, true);
        if (!confirmed) {
            // Cancel deletion and exit selection mode
            this.isSelectionMode = false;
            this.selectedFiles.clear();
            document.querySelectorAll('.pov-tile').forEach(t => t.classList.remove('selected'));
            document.getElementById('pov-btn-delete').style.display = 'none';
            return;
        }

        const deleteBtn = document.getElementById('pov-btn-delete');
        if (deleteBtn) deleteBtn.innerHTML = '<i class="fa-solid fa-spinner fa-spin"></i>';

        let hasError = false;
        
        // Convert Set to Array and process sequentially to avoid overwhelming the device
        const filesToDelete = Array.from(this.selectedFiles);
        for (const fileName of filesToDelete) {
            try {
                // The API expects the exact name as it was listed (with leading slash)
                const res = await fetch(`http://${this.masterIp}/delete?file=${fileName}`, { method: 'DELETE' });
                if (!res.ok) {
                    hasError = true;
                    Logger.error(`Failed to delete ${fileName}`);
                }
            } catch (err) {
                hasError = true;
                Logger.error(`Error deleting ${fileName}: ${err}`);
            }
        }

        if (hasError) {
            await this.showModal('Ошибка', 'Некоторые файлы не удалось удалить', false);
        } else {
            // Check if active file was deleted
            if (this.selectedFiles.has(this.activeFile)) {
                this.activeFile = null;
            }
            await this.showModal('Успех', 'Файлы успешно удалены', false);
        }

        // Reset selection
        this.isSelectionMode = false;
        this.selectedFiles.clear();
        if (deleteBtn) {
            deleteBtn.innerHTML = '<i class="fa-solid fa-trash"></i>';
            deleteBtn.style.display = 'none';
        }
        
        // Refresh gallery
        await this.loadGallery();
        
        // Refresh memory bar in Connection tab
        try {
            const res = await fetch(`http://${this.masterIp}/status`, { signal: AbortSignal.timeout(3000) });
            if (res.ok) {
                const fsInfo = await res.json();
                UI.updateDeviceMemory(this.masterIp, fsInfo.totalBytes, fsInfo.usedBytes);
            }
        } catch (err) {
            Logger.error(`Failed to refresh memory bar: ${err}`);
        }
    },

    scheduleUpdate() {
        if (!this.activeFile) return; // Only send updates if an animation is actively playing
        
        if (this.debounceTimer) {
            clearTimeout(this.debounceTimer);
        }
        
        this.debounceTimer = setTimeout(() => {
            this.sendPovCommand(this.activeFile, true);
        }, 100); // 100ms debounce
    },

    async playAnimation(fileName) {
        let isPlaying = true;
        
        // Toggle logic: if clicking on the same file, turn it off
        if (this.activeFile === fileName) {
            isPlaying = false;
        }

        Logger.log(`${isPlaying ? 'Playing' : 'Stopping'} animation: ${fileName}`);
        this.activeFile = isPlaying ? fileName : null;
        this.updateActiveUI();
        
        await this.sendPovCommand(fileName, isPlaying);
    },

    async sendPovCommand(fileName, isPlaying) {
        try {
            const response = await fetch(`http://${this.masterIp}/set_pov`, {
                method: 'POST',
                headers: {
                    'Content-Type': 'text/plain' 
                },
                body: JSON.stringify({
                    file: fileName,
                    groupId: 0,
                    brightness: this.controls.brightness, 
                    speed: this.controls.speed,      
                    gamma: this.controls.gamma,
                    play: isPlaying
                })
            });

            const result = await response.json();
            if (result.status !== 'ok') {
                Logger.error('Failed to set pov');
            }
        } catch (err) {
            Logger.error(`Failed to handle animation command: ${err}`);
        }
    },

    updateActiveUI() {
        const tiles = document.querySelectorAll('.pov-tile');
        tiles.forEach(tile => {
            const tileFile = tile.getAttribute('data-file');
            
            if (tileFile === this.activeFile) {
                tile.classList.add('playing');
            } else {
                tile.classList.remove('playing');
            }
        });
    }
};
