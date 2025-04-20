(function() {
    // Check if script is already initialized
    if (window.themeManager) return;

    // Theme configurations
    const themes = {
        'default': {
            name: 'Default',
            styles: {}
        },
        'high-contrast': {
            name: 'High Contrast',
            styles: {
                'background-color': '#000000',
                'color': '#FFFFFF',
                '--text-color': '#FFFFFF',
                '--background-color': '#000000',
                '--link-color': '#FFFF00',
                '--border-color': '#FFFFFF'
            }
        },
        'protanopia': {
            name: 'Protanopia (Red-Blind)',
            styles: {
                'filter': 'url("data:image/svg+xml,<svg xmlns=\'http://www.w3.org/2000/svg\'><filter id=\'protanopia\'><feColorMatrix type=\'matrix\' values=\'0.567,0.433,0,0,0 0.558,0.442,0,0,0 0,0.242,0.758,0,0 0,0,0,1,0\'/></filter></svg>#protanopia")'
            }
        },
        'deuteranopia': {
            name: 'Deuteranopia (Green-Blind)',
            styles: {
                'filter': 'url("data:image/svg+xml,<svg xmlns=\'http://www.w3.org/2000/svg\'><filter id=\'deuteranopia\'><feColorMatrix type=\'matrix\' values=\'0.625,0.375,0,0,0 0.7,0.3,0,0,0 0,0.3,0.7,0,0 0,0,0,1,0\'/></filter></svg>#deuteranopia")'
            }
        },
        'tritanopia': {
            name: 'Tritanopia (Blue-Blind)',
            styles: {
                'filter': 'url("data:image/svg+xml,<svg xmlns=\'http://www.w3.org/2000/svg\'><filter id=\'tritanopia\'><feColorMatrix type=\'matrix\' values=\'0.95,0.05,0,0,0 0,0.433,0.567,0,0 0,0.475,0.525,0,0 0,0,0,1,0\'/></filter></svg>#tritanopia")'
            }
        }
    };

    // Function to apply theme
    function applyTheme(themeName) {
        console.log('Applying theme:', themeName);
        const theme = themes[themeName];
        if (!theme) {
            console.error('Theme not found:', themeName);
            return false;
        }

        // Remove any existing theme styles
        const existingStyle = document.getElementById('accessibility-theme');
        if (existingStyle) {
            existingStyle.remove();
        }

        // Reset any existing theme attributes
        document.documentElement.removeAttribute('data-theme');
        document.documentElement.style.filter = '';
        document.body.style.filter = '';

        if (themeName === 'default') {
            // Just remove existing styles for default theme
            document.documentElement.setAttribute('data-theme', 'default');
            return true;
        }

        // Create new style element
        const style = document.createElement('style');
        style.id = 'accessibility-theme';
        
        // Apply styles based on theme type
        if (theme.styles.filter) {
            // For filter-based themes (colorblind modes)
            style.textContent = `
                :root {
                    filter: ${theme.styles.filter} !important;
                }
                img, video, canvas {
                    filter: ${theme.styles.filter} !important;
                }
            `;
            // Also apply directly to body for immediate effect
            document.body.style.filter = theme.styles.filter;
        } else {
            // For other themes (like high contrast)
            let css = 'html {';
            for (const [property, value] of Object.entries(theme.styles)) {
                css += `${property}: ${value} !important;`;
            }
            css += '}';
            style.textContent = css;
        }

        document.head.appendChild(style);
        document.documentElement.setAttribute('data-theme', themeName);
        console.log('Theme applied successfully:', themeName);
        return true;
    }

    // Initialize theme functionality
    function initializeTheme() {
        console.log('Initializing theme functionality');
        // Check for stored theme
        const currentTheme = document.documentElement.getAttribute('data-theme');
        if (currentTheme && themes[currentTheme]) {
            applyTheme(currentTheme);
        }
    }

    // Create theme manager object
    window.themeManager = {
        applyTheme: applyTheme,
        getThemes: () => themes,
        initialize: initializeTheme
    };

    // Initialize as soon as possible
    if (document.readyState === 'loading') {
        document.addEventListener('DOMContentLoaded', initializeTheme);
    } else {
        initializeTheme();
    }

    // Listen for theme change messages
    chrome.runtime.onMessage.addListener((request, sender, sendResponse) => {
        console.log('Received theme message:', request);
        if (request.action === 'applyTheme') {
            try {
                const result = applyTheme(request.theme);
                console.log('Theme application result:', result);
                sendResponse({ success: result });
            } catch (error) {
                console.error('Error applying theme:', error);
                sendResponse({ success: false, error: error.message });
            }
            return true; // Keep the message channel open for the async response
        }
    });
})(); 