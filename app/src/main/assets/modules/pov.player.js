import { Logger } from './dummy.js';
import { UI } from './ui.js';
import { POVManager } from './pov.manager.js';

export const POVPlayer = {
    isPlaying: false,
    trackName: null,
    playlist: [], // { id, name, previewUrl, timestamp }
    isSelectingImage: false,
    selectedImage: null, // { name, url }
    masterIp: null,
    audio: null,
    isDraggingProgress: false,
    triggeredEffects: new Set(), // Set of item.id already triggered for current playback
    syncTimer: null,
    lastTriggeredEffect: null, // Stores { name, groupId } of the last effect played

    init() {
        Logger.log('POVPlayer initialized');
        this.audio = new Audio();
        this.triggeredEffects = new Set();
        this.loadState();
        this.initEventListeners();
        this.initProgressScrubbing();
        this.initGroupOptions(); // Add this
        this.renderPlaylist();
    },

    saveState() {
        const state = {
            playlist: this.playlist,
            trackName: this.trackName || null
        };
        localStorage.setItem('pov_player_state', JSON.stringify(state));
    },

    loadState() {
        try {
            const data = localStorage.getItem('pov_player_state');
            if (data) {
                const state = JSON.parse(data);
                this.playlist = state.playlist || [];
                this.trackName = state.trackName || null;
                
                if (this.trackName) {
                    const displayTitle = this.trackName.length > 20 
                        ? this.trackName.substring(0, 20) + '...' 
                        : this.trackName;

                    // Update header title
                    const pageTitle = document.getElementById('page-title');
                    if (pageTitle) pageTitle.textContent = displayTitle;
                    
                    // Update nav item attribute so it persists across tab switches
                    const playerNav = document.querySelector('.nav-item[data-tab="tab-player"]');
                    if (playerNav) playerNav.setAttribute('data-title', displayTitle);

                    // Enable Add button
                    const btnAdd = document.getElementById('player-main-add');
                    if (btnAdd) btnAdd.disabled = false;
                    
                    Logger.log(`Restored track name: ${this.trackName} (Display: ${displayTitle})`);

                    // Try to restore actual audio from Android persistent storage
                    if (window.AndroidMusic) {
                        const persistentUrl = window.AndroidMusic.getLastTrackPath();
                        if (persistentUrl) {
                            this.audio.src = persistentUrl;
                            Logger.log(`Audio restored from persistent storage: ${persistentUrl}`);
                        }
                    }
                }
            }
        } catch (e) {
            Logger.error('Failed to load player state:', e);
        }
    },

    initGroupOptions() {
        const select = document.getElementById('player-add-group-id');
        if (!select) return;
        
        select.innerHTML = '';
        for (let i = 0; i <= 255; i++) {
            const opt = document.createElement('option');
            opt.value = i;
            opt.textContent = i === 0 ? 'Все (0)' : `Группа ${i}`;
            select.appendChild(opt);
        }
    },
    
    setMasterIp(ip) {
        this.masterIp = ip;
    },

    initEventListeners() {
        const btnAdd = document.getElementById('player-main-add');
        const btnMusic = document.getElementById('player-main-music');
        const audioInput = document.getElementById('player-audio-input');
        const btnToggle = document.getElementById('player-main-toggle');
        const btnStop = document.getElementById('player-main-stop');
        const btnMenu = document.getElementById('player-main-menu');
        
        // Modal elements
        const btnSelectImage = document.getElementById('player-add-select-image');
        const btnModalCancel = document.getElementById('player-modal-cancel');
        const btnModalAdd = document.getElementById('player-modal-add');
        
        if (btnAdd) {
            btnAdd.addEventListener('click', () => {
                this.showAddModal();
            });
        }

        if (btnMusic && audioInput) {
            btnMusic.addEventListener('click', () => {
                if (window.AndroidMusic) {
                    window.AndroidMusic.pickAudio();
                } else {
                    audioInput.click();
                }
            });

            audioInput.addEventListener('change', (e) => {
                const file = e.target.files[0];
                if (file) {
                    const url = URL.createObjectURL(file);
                    this.onAudioFileSelected(file.name, url);
                }
            });

            // Handle Android persistent audio loading
            window.addEventListener('audio:loaded', (e) => {
                const { name, url } = e.detail;
                this.onAudioFileSelected(name, url);
            });
        }

        if (btnSelectImage) {
            btnSelectImage.addEventListener('click', () => {
                this.startImageSelection();
            });
        }

        if (btnModalCancel) {
            btnModalCancel.addEventListener('click', () => {
                this.hideAddModal();
            });
        }

        if (btnModalAdd) {
            btnModalAdd.addEventListener('click', () => {
                this.addEffectToPlaylist();
            });
        }

        const chkDisable = document.getElementById('player-add-disable-effect');
        if (chkDisable) {
            chkDisable.addEventListener('change', () => {
                const btnModalAdd = document.getElementById('player-modal-add');
                if (chkDisable.checked) {
                    if (btnModalAdd) btnModalAdd.disabled = false;
                } else if (!this.selectedImage) {
                    if (btnModalAdd) btnModalAdd.disabled = true;
                }
            });
        }
        
        if (btnToggle) {
            btnToggle.addEventListener('click', () => {
                this.togglePlayback();
            });
        }

        if (btnStop) {
            btnStop.addEventListener('click', () => {
                this.stopPlayback();
            });
        }

        if (btnMenu) {
            btnMenu.addEventListener('click', () => {
                Logger.log('Player: Menu clicked');
                UI.showToast('Меню (в разработке)');
            });
        }

        // Handle audio events
        if (this.audio) {
            this.audio.addEventListener('timeupdate', () => {
                this.updateProgressBar();
            });

            this.audio.addEventListener('ended', () => {
                this.stopPlayback();
            });

            // Initial reset
            this.updateProgressBar();
        }
    },

    onAudioFileSelected(name, url) {
        this.audio.src = url;
        this.trackName = name;
        this.saveState();
        
        const displayTitle = name.length > 20 
            ? name.substring(0, 20) + '...' 
            : name;

        // Update header title
        const pageTitle = document.getElementById('page-title');
        if (pageTitle) pageTitle.textContent = displayTitle;
        
        // Update nav item attribute so it persists across tab switches
        const playerNav = document.querySelector('.nav-item[data-tab="tab-player"]');
        if (playerNav) playerNav.setAttribute('data-title', displayTitle);

        // Enable Add button
        const btnAdd = document.getElementById('player-main-add');
        if (btnAdd) btnAdd.disabled = false;

        Logger.log(`Track loaded: ${name} (Display: ${displayTitle})`);
        UI.showToast(`Трек загружен: ${displayTitle}`);
    },

    initProgressScrubbing() {
        const wrapper = document.querySelector('.player-v-progress-wrapper');
        const bar = document.querySelector('.player-v-progress-bar');
        if (!wrapper || !bar) return;

        const handleMove = (e) => {
            if (!this.isDraggingProgress || !this.audio || isNaN(this.audio.duration)) return;
            
            const rect = bar.getBoundingClientRect();
            const clientY = e.touches ? e.touches[0].clientY : e.clientY;
            
            // Calculate relative Y from bottom (0 to 1)
            let relY = 1 - (clientY - rect.top) / rect.height;
            relY = Math.max(0, Math.min(1, relY)); // Clamp between 0 and 1
            
            const newTime = relY * this.audio.duration;
            this.audio.currentTime = newTime;
            this.updateProgressBar();
        };

        const startDragging = (e) => {
            if (!this.audio || isNaN(this.audio.duration)) return;
            this.isDraggingProgress = true;
            handleMove(e);
            
            // Temporary disable transition for smooth drag
            const fill = document.getElementById('player-v-progress-fill');
            if (fill) fill.style.transition = 'none';

            // Show tooltip
            const tooltip = document.getElementById('player-v-time-tooltip');
            if (tooltip) tooltip.classList.add('visible');
        };

        const stopDragging = () => {
            this.isDraggingProgress = false;
            const fill = document.getElementById('player-v-progress-fill');
            if (fill) fill.style.transition = 'height 0.1s linear';

            // Hide tooltip (will fade out due to CSS transition)
            const tooltip = document.getElementById('player-v-time-tooltip');
            if (tooltip) tooltip.classList.remove('visible');
            
            // Recalculate which effects should be considered "already triggered" based on new position
            this.triggeredEffects.clear();
            const currentTime = this.audio.currentTime;
            this.playlist.forEach((item) => {
                // If we seek past an effect (including a small buffer), mark it as triggered
                if (currentTime > item.timestamp + 0.1) {
                    this.triggeredEffects.add(item.id);
                }
            });
            Logger.log(`Seeking finished at ${this.formatTime(currentTime)}, reset triggers.`);
        };

        wrapper.addEventListener('mousedown', startDragging);
        window.addEventListener('mousemove', handleMove);
        window.addEventListener('mouseup', stopDragging);

        wrapper.addEventListener('touchstart', (e) => {
            e.preventDefault();
            startDragging(e);
        }, { passive: false });
        
        window.addEventListener('touchmove', handleMove, { passive: false });
        window.addEventListener('touchend', stopDragging);
    },

    updateProgressBar() {
        const fill = document.getElementById('player-v-progress-fill');
        const tooltip = document.getElementById('player-v-time-tooltip');
        
        if (!fill || !this.audio || isNaN(this.audio.duration)) {
            if (fill) fill.style.height = '0%';
            if (tooltip) tooltip.textContent = '00:00';
            return;
        }

        const percent = (this.audio.currentTime / this.audio.duration) * 100;
        fill.style.height = `${percent}%`;

        // Update tooltip text
        if (tooltip) {
            tooltip.textContent = this.formatTime(this.audio.currentTime);
        }

        // Check for effects to trigger
        this.checkEffectsToTrigger();
    },

    checkEffectsToTrigger() {
        if (!this.isPlaying || !this.audio || isNaN(this.audio.duration)) return;

        const currentTime = this.audio.currentTime;
        
        this.playlist.forEach((item) => {
            if (this.triggeredEffects.has(item.id)) return;

            const diff = currentTime - item.timestamp;
            // Match if we are within 0s to 1s ahead of the timestamp
            if (diff >= 0 && diff < 1.0) {
                if (item.isPause) {
                    Logger.log(`[Sync] Triggering global PAUSE for group ${item.groupId}`);
                    this.triggerPOV("", item.groupId, false);
                } else {
                    Logger.log(`[Sync] Triggering effect: ${item.name} (ID: ${item.groupId}, Timestamp: ${item.timestamp}s)`);
                    this.triggerPOV(item.name, item.groupId, true);
                }
                this.triggeredEffects.add(item.id);
            }
        });
    },

    startSyncLoop() {
        if (this.syncTimer) return;
        
        Logger.log('[Sync] Starting loop');
        
        const loop = () => {
            if (this.isPlaying && this.audio && !this.audio.paused) {
                this.checkEffectsToTrigger();
                this.syncTimer = requestAnimationFrame(loop);
            } else {
                Logger.log('[Sync] Stopping loop');
                this.syncTimer = null;
            }
        };
        this.syncTimer = requestAnimationFrame(loop);
    },

    async setGlobalPlayback(play, groupId = 0, reset = false) {
        if (!this.masterIp) return;
        
        Logger.log(`[Sync] Global Playback: ${play} (Group: ${groupId}, Reset: ${reset})`);
        try {
            await fetch(`http://${this.masterIp}/set_play`, {
                method: 'POST',
                headers: { 'Content-Type': 'text/plain' },
                body: JSON.stringify({ play, groupId, reset })
            });
        } catch (err) {
            Logger.error('Global playback update failed:', err);
        }
    },

    async triggerPOV(fileName, groupId = 0, play = true) {
        if (!this.masterIp) {
            Logger.error('Cannot trigger POV: masterIp is not set');
            return;
        }
        
        Logger.log(`Sending trigger to ${this.masterIp}: ${fileName} (Group: ${groupId}, Play: ${play})`);
        
        if (play && fileName) {
            this.lastTriggeredEffect = { name: fileName, groupId: groupId };
        }
        
        try {
            // Must match format in POVManager.sendPovCommand
            const response = await fetch(`http://${this.masterIp}/set_pov`, {
                method: 'POST',
                headers: {
                    'Content-Type': 'text/plain' 
                },
                body: JSON.stringify({
                    file: fileName || "",
                    groupId: groupId,
                    brightness: POVManager.controls.brightness, 
                    speed: POVManager.controls.speed,      
                    gamma: POVManager.controls.gamma,
                    play: play
                })
            });
            
            if (!response.ok) {
                Logger.error(`Failed to trigger POV: ${response.status} ${response.statusText}`);
            } else {
                Logger.log(`POV trigger successful: ${fileName}`);
            }
        } catch (err) {
            Logger.error('Error triggering POV:', err);
        }
    },

    formatTime(seconds) {
        if (isNaN(seconds)) return '00:00';
        const m = Math.floor(seconds / 60);
        const s = Math.floor(seconds % 60);
        return `${m.toString().padStart(2, '0')}:${s.toString().padStart(2, '0')}`;
    },

    showAddModal(skipReset = false) {
        const modal = document.getElementById('player-add-modal');
        if (modal) modal.style.display = 'flex';
        if (!skipReset) this.resetModalState();
    },

    hideAddModal() {
        const modal = document.getElementById('player-add-modal');
        if (modal) modal.style.display = 'none';
    },

    resetModalState() {
        this.selectedImage = null;
        const field = document.getElementById('player-add-select-image');
        const preview = document.getElementById('player-selected-image-preview');
        const btnAdd = document.getElementById('player-modal-add');
        const chkDisable = document.getElementById('player-add-disable-effect');

        if (field) field.classList.remove('has-preview');
        if (preview) preview.style.display = 'none';
        if (btnAdd) btnAdd.disabled = true;
        if (chkDisable) chkDisable.checked = false;
    },

    startImageSelection() {
        this.isSelectingImage = true;
        // Hide the modal while we are in POV tab
        this.hideAddModal();
        
        // Switch to POV tab
        const povTabBtn = document.querySelector('.nav-item[data-tab="tab-pov"]');
        if (povTabBtn) povTabBtn.click();
    },

    onImageSelected(fileName) {
        if (!this.isSelectingImage) return;
        
        const imgUrl = `http://${this.masterIp}/${fileName}`;
        this.selectedImage = {
            name: fileName,
            url: imgUrl
        };
        
        this.isSelectingImage = false;

        // Switch back to Player tab
        const playerTabBtn = document.querySelector('.nav-item[data-tab="tab-player"]');
        if (playerTabBtn) playerTabBtn.click();
        
        // Show the modal again WITHOUT resetting selectedImage
        this.showAddModal(true);
        
        // Update Modal UI
        const field = document.getElementById('player-add-select-image');
        const preview = document.getElementById('player-selected-image-preview');
        const previewImg = preview?.querySelector('img');
        const btnAdd = document.getElementById('player-modal-add');

        if (field) field.classList.add('has-preview');
        if (previewImg) previewImg.src = imgUrl;
        if (preview) preview.style.display = 'block';
        if (btnAdd) btnAdd.disabled = false;
        
        Logger.log(`Image selected for player: ${fileName}`);
    },

    addEffectToPlaylist() {
        const chkDisable = document.getElementById('player-add-disable-effect');
        const isPause = chkDisable ? chkDisable.checked : false;

        if (!this.selectedImage && !isPause) return;
        
        const timestamp = this.audio ? this.audio.currentTime : 0;
        const groupEl = document.getElementById('player-add-group-id');
        const groupId = groupEl ? parseInt(groupEl.value) : 0;
        
        this.playlist.push({
            id: Date.now() + Math.random().toString(36).substr(2, 9),
            name: isPause ? 'ПАУЗА' : (this.selectedImage ? this.selectedImage.name : ''),
            previewUrl: isPause ? null : (this.selectedImage ? this.selectedImage.url : null),
            timestamp: timestamp,
            groupId: groupId,
            isPause: isPause
        });
        
        // Sort playlist by timestamp
        this.playlist.sort((a, b) => a.timestamp - b.timestamp);
        
        this.saveState();
        this.renderPlaylist();
        this.hideAddModal();
        Logger.log(`Effect added: ${isPause ? 'Pause' : this.selectedImage.name} at ${this.formatTime(timestamp)}`);
    },

    renderPlaylist() {
        const container = document.getElementById('player-playlist');
        if (!container) return;

        if (this.playlist.length === 0) {
            container.innerHTML = '<div class="empty-msg">«Плейлист пуст. Прежде чем добавлять эффект, выберите трек. Нажмите +, чтобы добавить эффект»</div>';
            return;
        }

        container.innerHTML = '';
        this.playlist.forEach((item) => {
            const el = document.createElement('div');
            el.className = 'playlist-item';
            
            el.innerHTML = `
                <div class="playlist-preview">
                    ${item.isPause ? '<i class="fa-solid fa-pause pause-icon"></i>' : `<img src="${item.previewUrl}" alt="">`}
                </div>
                <div class="playlist-info">
                    <div class="playlist-group-id">ID: ${item.groupId !== undefined ? item.groupId : 0}</div>
                    <div class="playlist-time">${this.formatTime(item.timestamp)}</div>
                </div>
                <button class="playlist-item-remove" title="Удалить">
                    <i class="fa-solid fa-xmark"></i>
                </button>
            `;
            
            const btnRemove = el.querySelector('.playlist-item-remove');
            if (btnRemove) {
                btnRemove.addEventListener('click', (e) => {
                    e.stopPropagation();
                    this.removeFromPlaylist(item.id);
                });
            }
            
            container.appendChild(el);
        });
    },

    removeFromPlaylist(id) {
        this.playlist = this.playlist.filter(item => item.id !== id);
        this.saveState();
        this.renderPlaylist();
        Logger.log(`Effect removed: ${id}`);
    },

    togglePlayback() {
        if (!this.audio.src) {
            UI.showToast('Сначала выберите звуковой трек');
            return;
        }

        this.isPlaying = !this.isPlaying;
        
        if (this.isPlaying) {
            this.audio.play().then(() => {
                this.startSyncLoop();
                // Resume animation on all devices
                this.setGlobalPlayback(true, 0);
            }).catch(err => {
                Logger.error('Playback failed:', err);
                this.isPlaying = false;
                this.updateIcons();
            });
        } else {
            this.audio.pause();
            // Pause animation on all devices
            this.setGlobalPlayback(false, 0);
        }

        Logger.log(`Player: ${this.isPlaying ? 'Play' : 'Pause'}`);
        this.updateIcons();
    },

    stopPlayback() {
        this.isPlaying = false;
        if (this.audio) {
            this.audio.pause();
            this.audio.currentTime = 0;
        }
        this.triggeredEffects.clear();
        this.lastTriggeredEffect = null;
        if (this.syncTimer) {
            cancelAnimationFrame(this.syncTimer);
            this.syncTimer = null;
        }
        
        // Stop POV animation and clear memory on all devices
        this.setGlobalPlayback(false, 0, true);
        
        Logger.log('Player: Stop');
        this.updateIcons();
    },

    updateIcons() {
        const icon = document.getElementById('player-main-play-icon');
        if (icon) {
            if (this.isPlaying) {
                icon.classList.remove('fa-circle-play');
                icon.classList.add('fa-circle-pause');
            } else {
                icon.classList.remove('fa-circle-pause');
                icon.classList.add('fa-circle-play');
            }
        }
    }
};
