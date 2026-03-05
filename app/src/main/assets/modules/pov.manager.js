import { Logger } from './dummy.js';

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
            `;

            tile.addEventListener('click', () => {
                this.playAnimation(file.name);
            });

            grid.appendChild(tile);
        });
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
