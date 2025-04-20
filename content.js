// Speech recognition setup
let recognition = null;

// Function to initialize speech recognition
function initializeSpeechRecognition() {
    try {
        // Check if speech recognition is supported
        if (!('webkitSpeechRecognition' in window) && !('SpeechRecognition' in window)) {
            throw new Error('Speech recognition is not supported in this browser');
        }

        // Initialize speech recognition
        recognition = new (window.SpeechRecognition || window.webkitSpeechRecognition)();
        console.log('Speech recognition initialized successfully');

        // Configure recognition settings
        recognition.continuous = true;
        recognition.interimResults = true;
        recognition.lang = 'en-US'; // Set language to English
        recognition.maxAlternatives = 1;

        // Add event listeners for debugging
        recognition.onstart = () => {
            console.log('Speech recognition started');
        };

        recognition.onerror = (event) => {
            console.error('Speech recognition error:', event.error);
            // Map error codes to human-readable messages
            const errorMessages = {
                'no-speech': 'No speech was detected',
                'aborted': 'Speech recognition was aborted',
                'audio-capture': 'No microphone was found',
                'network': 'Network error occurred',
                'not-allowed': 'Microphone access was denied',
                'service-not-allowed': 'Speech recognition service is not allowed',
                'bad-grammar': 'Bad grammar error',
                'language-not-supported': 'Language not supported'
            };
            console.error('Error details:', errorMessages[event.error] || 'Unknown error');
        };

        recognition.onend = () => {
            console.log('Speech recognition ended');
        };

        return true;
    } catch (error) {
        console.error('Error initializing speech recognition:', error);
        return false;
    }
}

// Common websites mapping
const commonWebsites = {
    'google': 'https://www.google.com',
    'youtube': 'https://www.youtube.com',
    'facebook': 'https://www.facebook.com',
    'twitter': 'https://www.twitter.com',
    'amazon': 'https://www.amazon.com',
    'github': 'https://www.github.com',
    'linkedin': 'https://www.linkedin.com'
};

// Command handlers
const commandHandlers = {
    'open': (website) => {
        const url = commonWebsites[website.toLowerCase()];
        if (url) {
            window.open(url, '_blank');
        }
    },
    'scroll': (direction) => {
        const scrollAmount = 200;
        if (direction === 'up') {
            window.scrollBy(0, -scrollAmount);
        } else if (direction === 'down') {
            window.scrollBy(0, scrollAmount);
        }
    },
    'refresh': () => {
        window.location.reload();
    },
    'click': (target) => {
        const elements = document.querySelectorAll('a, button');
        for (const element of elements) {
            if (element.textContent.toLowerCase().includes(target.toLowerCase())) {
                element.click();
                break;
            }
        }
    }
};

// Listen for messages from the popup and background script
chrome.runtime.onMessage.addListener((request, sender, sendResponse) => {
    console.log('Received message:', request);
    
    if (request.action === 'initialize') {
        const initialized = initializeSpeechRecognition();
        sendResponse({status: initialized ? 'success' : 'error', message: initialized ? '' : 'Failed to initialize speech recognition'});
        return true;
    }
    
    if (request.action === 'startListening') {
        if (!recognition) {
            // Try to initialize speech recognition if it's not already initialized
            const initialized = initializeSpeechRecognition();
            if (!initialized) {
                sendResponse({status: 'error', message: 'Failed to initialize speech recognition'});
                return true;
            }
        }

        try {
            // Check if recognition is already running
            if (recognition.running) {
                console.log('Recognition is already running');
                sendResponse({status: 'success'});
                return true;
            }
            
            // Set up the result handler
            recognition.onresult = (event) => {
                const transcript = event.results[event.results.length - 1][0].transcript.toLowerCase();
                console.log('Recognized speech:', transcript);
                
                // Parse commands
                if (transcript.includes('open')) {
                    const website = transcript.split('open')[1].trim();
                    commandHandlers.open(website);
                } else if (transcript.includes('scroll')) {
                    const direction = transcript.includes('up') ? 'up' : 'down';
                    commandHandlers.scroll(direction);
                } else if (transcript.includes('refresh')) {
                    commandHandlers.refresh();
                } else if (transcript.includes('click')) {
                    const target = transcript.split('click')[1].trim();
                    commandHandlers.click(target);
                }
            };

            recognition.start();
            console.log('Started listening');
            sendResponse({status: 'success'});
        } catch (error) {
            console.error('Error starting recognition:', error);
            sendResponse({status: 'error', message: error.message || 'Failed to start recognition'});
        }
    } else if (request.action === 'stopListening') {
        if (recognition) {
            try {
                recognition.stop();
                console.log('Stopped listening');
                sendResponse({status: 'success'});
            } catch (error) {
                console.error('Error stopping recognition:', error);
                sendResponse({status: 'error', message: error.message || 'Failed to stop recognition'});
            }
        }
    }
    return true; // Required for async sendResponse
});

// Notify that content script is loaded
console.log('Voice Navigator content script loaded'); 