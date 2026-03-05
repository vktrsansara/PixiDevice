import { Logger } from './dummy.js';
import { UI } from './ui.js';

export const POVPlayer = {
    isPlaying: false,
    playlist: [], // { name: '...', previewUrl: '...' }
    isSelectingImage: false,
    selectedImage: null, // { name, url }
    masterIp: null,
    audio: null,
    isDraggingProgress: false,

    init() {
        Logger.log('POVPlayer initialized');
        this.audio = new Audio();
        this.initEventListeners();
        this.initProgressScrubbing();
        this.renderPlaylist();
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
                audioInput.click();
            });

            audioInput.addEventListener('change', (e) => {
                const file = e.target.files[0];
                if (file) {
                    const url = URL.createObjectURL(file);
                    this.audio.src = url;
                    
                    // Update header title
                    const pageTitle = document.getElementById('page-title');
                    if (pageTitle) pageTitle.textContent = file.name;
                    
                    // Update nav item attribute so it persists across tab switches
                    const playerNav = document.querySelector('.nav-item[data-tab="tab-player"]');
                    if (playerNav) playerNav.setAttribute('data-title', file.name);

                    Logger.log(`Track loaded: ${file.name}`);
                    UI.showToast(`Трек загружен: ${file.name}`);
                }
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

        if (field) field.classList.remove('has-preview');
        if (preview) preview.style.display = 'none';
        if (btnAdd) btnAdd.disabled = true;
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
        if (!this.selectedImage) return;
        
        this.playlist.push({
            name: this.selectedImage.name,
            previewUrl: this.selectedImage.url
        });
        
        this.renderPlaylist();
        this.hideAddModal();
        Logger.log(`Effect added: ${this.selectedImage.name}`);
    },

    renderPlaylist() {
        const container = document.getElementById('player-playlist');
        if (!container) return;

        if (this.playlist.length === 0) {
            container.innerHTML = '<div class="empty-msg">Плейлист пуст. Нажмите +, чтобы добавить эффект.</div>';
            return;
        }

        container.innerHTML = '';
        this.playlist.forEach((item, index) => {
            const el = document.createElement('div');
            el.className = 'playlist-item';
            
            el.innerHTML = `
                <div class="playlist-preview">
                    <img src="${item.previewUrl}" alt="">
                </div>
                <button class="playlist-item-remove" title="Удалить">
                    <i class="fa-solid fa-xmark"></i>
                </button>
            `;
            
            const btnRemove = el.querySelector('.playlist-item-remove');
            if (btnRemove) {
                btnRemove.addEventListener('click', (e) => {
                    e.stopPropagation();
                    this.removeFromPlaylist(index);
                });
            }
            
            container.appendChild(el);
        });
    },

    removeFromPlaylist(index) {
        this.playlist.splice(index, 1);
        this.renderPlaylist();
        Logger.log(`Effect removed at index ${index}`);
    },

    togglePlayback() {
        if (!this.audio.src) {
            UI.showToast('Сначала выберите звуковой трек');
            return;
        }

        this.isPlaying = !this.isPlaying;
        
        if (this.isPlaying) {
            this.audio.play().catch(err => {
                Logger.error('Playback failed:', err);
                this.isPlaying = false;
                this.updateIcons();
            });
        } else {
            this.audio.pause();
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
