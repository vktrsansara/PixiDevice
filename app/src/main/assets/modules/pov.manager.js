import { Logger } from './dummy.js';

export const POVManager = {
    masterIp: null,
    activeFile: null,

    init() {
        Logger.log('POVManager initialized');
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

    async playAnimation(fileName) {
        let isPlaying = true;
        
        // Toggle logic: if clicking on the same file, turn it off
        if (this.activeFile === fileName) {
            isPlaying = false;
        }

        Logger.log(`${isPlaying ? 'Playing' : 'Stopping'} animation: ${fileName}`);
        
        try {
            const response = await fetch(`http://${this.masterIp}/set_pov`, {
                method: 'POST',
                headers: {
                    'Content-Type': 'text/plain' 
                },
                body: JSON.stringify({
                    file: fileName,
                    groupId: 0,
                    brightness: 128, 
                    speed: 100,      
                    play: isPlaying
                })
            });

            const result = await response.json();
            if (result.status === 'ok') {
                this.activeFile = isPlaying ? fileName : null;
                this.updateActiveUI();
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
