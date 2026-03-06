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
    isRepeat: false,
    virtualCurrentTime: 0,
    virtualTimer: null,
    virtualDuration: 0,

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
            trackName: this.trackName || null,
            isRepeat: this.isRepeat
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
                this.isRepeat = state.isRepeat || false;

                // Update Repeat UI highlight
                const btnRepeat = document.getElementById('player-menu-repeat');
                if (btnRepeat) {
                    if (this.isRepeat) btnRepeat.classList.add('active');
                    else btnRepeat.classList.remove('active');
                }
                
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

                    // Enable Add button (Always enabled now)
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
            btnAdd.disabled = false;
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
            btnMenu.addEventListener('click', (e) => {
                e.stopPropagation();
                const dropdown = document.getElementById('player-menu-dropdown');
                if (dropdown) dropdown.classList.toggle('active');
            });
        }

        const btnClear = document.getElementById('player-menu-clear');
        if (btnClear) {
            btnClear.addEventListener('click', () => {
                this.clearScene();
            });
        }

        const btnRepeat = document.getElementById('player-menu-repeat');
        if (btnRepeat) {
            btnRepeat.addEventListener('click', () => {
                this.toggleRepeat();
            });
        }

        const btnSaveMenu = document.getElementById('player-menu-save');
        if (btnSaveMenu) {
            btnSaveMenu.addEventListener('click', () => {
                this.showSaveModal();
            });
        }

        const btnOpenMenu = document.getElementById('player-menu-open');
        if (btnOpenMenu) {
            btnOpenMenu.addEventListener('click', () => {
                this.openPlaylist();
            });
        }

        const btnSaveCancel = document.getElementById('player-save-cancel');
        if (btnSaveCancel) {
            btnSaveCancel.addEventListener('click', () => {
                this.hideSaveModal();
            });
        }

        const btnSaveConfirm = document.getElementById('player-save-confirm');
        if (btnSaveConfirm) {
            btnSaveConfirm.addEventListener('click', () => {
                const filenameInput = document.getElementById('player-save-filename');
                if (filenameInput && filenameInput.value.trim() !== '') {
                    POVPlayer.savePlaylist(filenameInput.value.trim());
                } else {
                    UI.showToast('Введите имя файла');
                }
            });
        }

        // Close menu when clicking outside
        document.addEventListener('click', (e) => {
            const dropdown = document.getElementById('player-menu-dropdown');
            const btnMenu = document.getElementById('player-main-menu');
            if (dropdown && dropdown.classList.contains('active')) {
                if (!dropdown.contains(e.target) && !btnMenu.contains(e.target)) {
                    dropdown.classList.remove('active');
                }
            }
        });

        // Handle audio events
        if (this.audio) {
            this.audio.addEventListener('timeupdate', () => {
                this.updateProgressBar();
            });

            this.audio.addEventListener('ended', () => {
                if (this.isRepeat) {
                    Logger.log('POVPlayer: Repeat active, restarting track...');
                    this.triggeredEffects.clear();
                    this.audio.currentTime = 0;
                    this.audio.play();
                } else {
                    this.stopPlayback();
                }
            });
        }

        window.addEventListener('playlist:save_result', (e) => {
            const data = e.detail;
            if (data && data.success) {
                UI.showToast('Файл сохранен');
            } else {
                UI.showToast('Ошибка: ' + (data ? data.message : 'Unknown error'));
            }
            POVPlayer.hideSaveModal();
        });

        window.addEventListener('playlist:loaded', (e) => {
            const { json } = e.detail;
            UI.showToast('Плейлист открыт');
            POVPlayer.handlePlaylistLoaded(json);
        });

        // Initial reset
        this.updateProgressBar();
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
        if (!fill) return;

        let percent = 0;
        let currentTime = 0;
        let duration = 0;

        if (this.trackName && this.audio && !isNaN(this.audio.duration)) {
            currentTime = this.audio.currentTime;
            duration = this.audio.duration;
            percent = (currentTime / duration) * 100;
        } else if (!this.trackName && this.virtualDuration > 0) {
            currentTime = this.virtualCurrentTime;
            duration = this.virtualDuration;
            percent = (currentTime / duration) * 100;
        }

        fill.style.height = `${percent}%`;

        // Update tooltip
        const tooltip = document.getElementById('player-v-time-tooltip');
        if (tooltip) {
            tooltip.textContent = this.formatTime(currentTime);
            // Move tooltip with thumb
            tooltip.style.bottom = `${percent}%`;
        }
    },

    checkEffectsToTrigger() {
        if (!this.isPlaying) return;

        let currentTime;
        if (this.trackName && this.audio && !isNaN(this.audio.duration)) {
            currentTime = this.audio.currentTime;
        } else if (!this.trackName && this.virtualDuration > 0) {
            currentTime = this.virtualCurrentTime;
        } else {
            return; // No valid playback source
        }
        
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
        
        // Toggle time offset input based on track presence
        const timeGroup = document.getElementById('player-modal-time-group');
        if (timeGroup) {
            timeGroup.style.display = (this.trackName ? 'none' : 'block');
        }

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

        const timeInput = document.getElementById('modal-time-input');
        if (timeInput) timeInput.value = (this.playlist.length === 0 ? "10" : "30");
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
        
        let timestamp = 0;
        if (this.trackName && this.audio) {
            timestamp = this.audio.currentTime;
        } else {
            // Calculate cumulative time based on manual offset
            const timeInput = document.getElementById('modal-time-input');
            const offset = timeInput ? parseFloat(timeInput.value) || 0 : 0;
            
            let lastTimestamp = 0;
            if (this.playlist.length > 0) {
                // Get the timestamp of the last added item
                lastTimestamp = this.playlist[this.playlist.length - 1].timestamp;
            }
            timestamp = lastTimestamp + offset;
        }

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
            container.innerHTML = '<div class="empty-msg">Плейлист пуст. Нажмите +, чтобы добавить эффект</div>';
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
        if (this.playlist.length === 0 && !this.trackName) {
            UI.showToast('Плейлист пуст');
            return;
        }

        if (this.isPlaying) {
            this.stopPlayback();
        } else {
            this.isPlaying = true;
            this.updateIcons();
            this.triggeredEffects.clear();

            if (this.trackName && this.audio) {
                this.audio.play();
                this.startSyncLoop();
            } else {
                // Start Virtual Playback
                Logger.log('POVPlayer: Starting virtual playback...');
                
                // Calculate virtual duration from the last element
                if (this.playlist.length > 0) {
                    this.virtualDuration = this.playlist[this.playlist.length - 1].timestamp + 2; // +2s buffer
                } else {
                    this.virtualDuration = 10;
                }
                
                this.virtualCurrentTime = 0;
                this.startVirtualLoop();
            }
            
            this.setGlobalPlayback(true, 0, true);
        }
    },

    startVirtualLoop() {
        if (this.virtualTimer) clearInterval(this.virtualTimer);
        
        const startTime = Date.now();
        this.virtualTimer = setInterval(() => {
            if (!this.isPlaying) {
                clearInterval(this.virtualTimer);
                this.virtualTimer = null;
                return;
            }

            const elapsed = (Date.now() - startTime) / 1000;
            this.virtualCurrentTime = elapsed;
            
            this.updateProgressBar();
            this.checkEffectsToTrigger();

            if (this.virtualCurrentTime >= this.virtualDuration) {
                if (this.isRepeat) {
                    this.virtualCurrentTime = 0;
                    this.triggeredEffects.clear();
                    // Just restart the loop logic by clearing and restarting if needed
                    // but simplest is to keep the timer and reset startTime
                    this.togglePlayback(); // Stop
                    this.togglePlayback(); // Start again
                } else {
                    this.stopPlayback();
                }
            }
        }, 100);
    },

    stopPlayback() {
        this.isPlaying = false;
        if (this.trackName && this.audio) {
            this.audio.pause();
            this.audio.currentTime = 0;
        }
        
        if (this.virtualTimer) {
            clearInterval(this.virtualTimer);
            this.virtualTimer = null;
        }

        if (this.syncTimer) {
            cancelAnimationFrame(this.syncTimer);
            this.syncTimer = null;
        }
        
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
    },

    clearScene() {
        Logger.log('POVPlayer: Clearing scene...');
        
        // 1. Stop playback
        this.stopPlayback();
        
        // 2. Clear data
        this.playlist = [];
        this.trackName = null;
        this.audio.src = '';
        this.triggeredEffects.clear();
        this.lastTriggeredEffect = null;
        
        // 3. Reset UI
        // Reset header title
        const pageTitle = document.getElementById('page-title');
        if (pageTitle) pageTitle.textContent = 'Плеер';
        
        // Reset nav item attribute
        const playerNav = document.querySelector('.nav-item[data-tab="tab-player"]');
        if (playerNav) playerNav.setAttribute('data-title', 'Плеер');
        
        // Add button remains enabled
        const btnAdd = document.getElementById('player-main-add');
        if (btnAdd) btnAdd.disabled = false;
        
        // Re-render empty playlist
        this.renderPlaylist();
        
        // Reset progress bar
        this.updateProgressBar();
        
        // 4. Save state
        this.saveState();
        
        // 5. Close menu
        const dropdown = document.getElementById('player-menu-dropdown');
        if (dropdown) dropdown.classList.remove('active');
        
        UI.showToast('Сцена очищена');
    },

    toggleRepeat() {
        this.isRepeat = !this.isRepeat;
        Logger.log(`POVPlayer: Repeat set to ${this.isRepeat}`);
        
        const btnRepeat = document.getElementById('player-menu-repeat');
        if (btnRepeat) {
            if (this.isRepeat) btnRepeat.classList.add('active');
            else btnRepeat.classList.remove('active');
        }
        
        this.saveState();
        UI.showToast(this.isRepeat ? 'Повтор включен' : 'Повтор выключен');
        
        // Close menu after selection
        const dropdown = document.getElementById('player-menu-dropdown');
        if (dropdown) dropdown.classList.remove('active');
    },

    showSaveModal() {
        const modal = document.getElementById('player-save-modal');
        const input = document.getElementById('player-save-filename');
        if (modal) {
            modal.style.display = 'flex';
            if (input) {
                const now = new Date();
                const pad = (n) => n.toString().padStart(2, '0');
                const dateStr = `${pad(now.getDate())}.${pad(now.getMonth() + 1)}.${now.getFullYear().toString().substr(-2)}`;
                const timeStr = `${pad(now.getHours())}.${pad(now.getMinutes())}.${pad(now.getSeconds())}`;
                input.value = `playlist_${dateStr}_${timeStr}`;
            }
        }
        // Close menu
        const dropdown = document.getElementById('player-menu-dropdown');
        if (dropdown) dropdown.classList.remove('active');
    },

    hideSaveModal() {
        const modal = document.getElementById('player-save-modal');
        if (modal) {
            modal.style.display = 'none';
        }
    },

    savePlaylist(filename) {
        if (!filename) return;

        const data = {
            trackName: this.trackName,
            playlist: this.playlist,
            isRepeat: this.isRepeat
        };

        const json = JSON.stringify(data);
        if (window.AndroidPlaylist) {
            window.AndroidPlaylist.savePlaylist(filename, json);
        } else {
            UI.showToast('Функция недоступна в браузере');
        }
    },

    openPlaylist() {
        if (window.AndroidPlaylist) {
            window.AndroidPlaylist.pickPlaylist();
        } else {
            Logger.error('AndroidPlaylist interface not available');
            UI.showToast('Функция недоступна в браузере');
        }
        // Close menu
        const dropdown = document.getElementById('player-menu-dropdown');
        if (dropdown) dropdown.classList.remove('active');
    },

    handlePlaylistLoaded(json) {
        try {
            const data = JSON.parse(json);
            if (data.playlist) {
                this.playlist = data.playlist;
                this.isRepeat = data.isRepeat || false;
                
                // Track name might be different now, but we don't necessarily have the file
                // If the user has the track file loaded, we keep it, otherwise trackName is just a label
                // For now, let's just clear the track if it doesn't match or keep it as is.
                // Requirement said "Clear scene" clears playlist AND track.
                // Open playlist restores playlist.
                
                this.renderPlaylist();
                this.saveState();
                
                // Update Repeat UI
                const btnRepeat = document.getElementById('player-menu-repeat');
                if (btnRepeat) {
                    if (this.isRepeat) btnRepeat.classList.add('active');
                    else btnRepeat.classList.remove('active');
                }

                Logger.log('Playlist loaded and state saved');
            }
        } catch (err) {
            Logger.error('Failed to parse playlist JSON:', err);
            UI.showToast('Ошибка при загрузке файла');
        }
    }
};
