import { Logger } from './dummy.js';

export const CustomSelect = {
    init() {
        this.updateAll();
        // Watch for DOM changes to automatically apply to new selects
        const observer = new MutationObserver(() => this.updateAll());
        observer.observe(document.body, { childList: true, subtree: true });
    },

    updateAll() {
        const selects = document.querySelectorAll('select:not(.custom-select-hidden)');
        selects.forEach(select => this.enhance(select));
    },

    enhance(select) {
        if (select.classList.contains('custom-select-hidden')) return;

        const wrapper = document.createElement('div');
        wrapper.className = 'custom-select-wrapper';
        
        const selected = document.createElement('div');
        selected.className = 'custom-select-trigger';
        selected.innerHTML = `<span></span><i class="fa-solid fa-chevron-down"></i>`;
        
        const optionsContainer = document.createElement('div');
        optionsContainer.className = 'custom-select-options';

        select.classList.add('custom-select-hidden');
        select.parentNode.insertBefore(wrapper, select);
        wrapper.appendChild(select);
        wrapper.appendChild(selected);
        wrapper.appendChild(optionsContainer);

        this.renderOptions(select, optionsContainer, selected);

        selected.addEventListener('click', (e) => {
            e.stopPropagation();
            const isOpen = wrapper.classList.contains('open');
            this.closeAll();
            if (!isOpen) wrapper.classList.add('open');
        });

        // Watch for option changes
        const optionsObserver = new MutationObserver(() => {
            this.renderOptions(select, optionsContainer, selected);
        });
        optionsObserver.observe(select, { childList: true });

        // Update when native select changes (value selection)
        select.addEventListener('change', () => {
            this.updateTrigger(selected, select.options[select.selectedIndex]?.text || '');
            Array.from(optionsContainer.children).forEach(child => {
                child.classList.toggle('selected', child.dataset.value === select.value);
            });
        });
    },

    renderOptions(select, container, trigger) {
        container.innerHTML = '';
        Array.from(select.options).forEach((opt) => {
            const optionDiv = document.createElement('div');
            optionDiv.className = `custom-select-option ${opt.selected ? 'selected' : ''}`;
            optionDiv.textContent = opt.text;
            optionDiv.dataset.value = opt.value;
            
            optionDiv.addEventListener('click', (e) => {
                e.stopPropagation();
                select.value = opt.value;
                select.dispatchEvent(new Event('change'));
                this.updateTrigger(trigger, opt.text);
                this.closeAll();
            });
            container.appendChild(optionDiv);
        });
        this.updateTrigger(trigger, select.options[select.selectedIndex]?.text || '');
    },

    updateTrigger(trigger, text) {
        const span = trigger.querySelector('span');
        if (span) span.textContent = text;
    },

    closeAll() {
        document.querySelectorAll('.custom-select-wrapper.open').forEach(w => w.classList.remove('open'));
    }
};

// Close on outside click
document.addEventListener('click', () => CustomSelect.closeAll());
