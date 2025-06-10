// Archived settings-related code
function createSettingsMenu() {
    const menu = document.createElement('div');
    menu.className = 'settings-menu';

    const createToggle = (text, key) => {
        const item = document.createElement('div');
        item.className = 'settings-menu-item';
        
        const label = document.createElement('span');
        label.textContent = text;
        
        const toggle = document.createElement('label');
        toggle.className = 'toggle-switch';
        
        const input = document.createElement('input');
        input.type = 'checkbox';
        const settings = stateManager.get('settings');
        input.checked = settings[key];
        
        const slider = document.createElement('span');
        slider.className = 'toggle-slider';
        
        toggle.append(input, slider);
        item.append(label, toggle);

        // Make the entire row clickable
        item.addEventListener('click', (e) => {
            if (e.target !== input) {
                input.checked = !input.checked;
                const updatedSettings = stateManager.get('settings');
                updatedSettings[key] = input.checked;
                stateManager.set('settings', updatedSettings);
                stateManager.saveSettings();
                renderPins();
            }
        });

        input.addEventListener('change', () => {
            const updatedSettings = stateManager.get('settings');
            updatedSettings[key] = input.checked;
            stateManager.set('settings', updatedSettings);
            stateManager.saveSettings();
            renderPins();
        });
        
        return item;
    };

    menu.append(
        createToggle('Show Labels', 'showLabels'),
        createToggle('Show Bookmark Prompt', 'showPrompt')
    );

    return menu;
}

// CSS for settings menu
/*
.settings-menu {
    position: fixed;
    background: #2b2b2b;
    border-radius: 4px;
    padding: 2px 0;
    z-index: 10001;
    min-width: 220px;
    color: #fff;
    font-size: 12px;
    opacity: 0;
    visibility: hidden;
    transition: opacity 0.15s, visibility 0.15s;
}

.settings-menu::before {
    content: '';
    position: absolute;
    bottom: -4px;
    left: 50%;
    transform: translateX(-50%) rotate(45deg);
    width: 8px;
    height: 8px;
    background: #2b2b2b;
}

.settings-menu.visible {
    opacity: 1;
    visibility: visible;
}

.settings-menu-item {
    display: flex;
    align-items: center;
    justify-content: space-between;
    padding: 8px 12px;
    cursor: pointer;
    transition: background-color 0.2s;
    color: #fff;
    white-space: nowrap;
}

.settings-menu-item:hover {
    background-color: #3f3f3f;
}

.toggle-switch {
    position: relative;
    display: inline-block;
    width: 28px;
    height: 16px;
}

.toggle-switch input {
    opacity: 0;
    width: 0;
    height: 0;
}

.toggle-slider {
    position: absolute;
    cursor: pointer;
    top: 0;
    left: 0;
    right: 0;
    bottom: 0;
    background-color: #666;
    transition: .2s;
    border-radius: 16px;
}

.toggle-slider:before {
    position: absolute;
    content: "";
    height: 12px;
    width: 12px;
    left: 2px;
    bottom: 2px;
    background-color: white;
    transition: .2s;
    border-radius: 50%;
}

.toggle-switch input:checked + .toggle-slider {
    background-color: #3ea6ff;
}

.toggle-switch input:checked + .toggle-slider:before {
    transform: translateX(12px);
}
*/ 