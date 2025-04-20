document.addEventListener('DOMContentLoaded', () => {
  const startButton = document.getElementById('startBtn');
  const stopButton = document.getElementById('stopBtn');
  const toggleTTSButton = document.getElementById('toggleTTSBtn');
  const toggleCursorButton = document.getElementById('toggleCursorBtn');
  const statusText = document.getElementById('status');
  const ttsStatusText = document.getElementById('ttsStatus');

  // Check if speech recognition is supported
  if (!('webkitSpeechRecognition' in window) && !('SpeechRecognition' in window)) {
    statusText.textContent = 'Speech recognition not supported in this browser';
    statusText.className = 'status not-listening';
    startButton.disabled = true;
    return;
  }

  // Check microphone access
  async function checkMicrophoneAccess() {
    try {
      const stream = await navigator.mediaDevices.getUserMedia({ audio: true });
      stream.getTracks().forEach(track => track.stop());
      return true;
    } catch (error) {
      console.error('Microphone access error:', error);
      return false;
    }
  }

  // Initialize buttons and status
  async function initialize() {
    const hasMicrophoneAccess = await checkMicrophoneAccess();
    if (!hasMicrophoneAccess) {
      statusText.textContent = 'Microphone access denied. Please grant permission.';
      statusText.className = 'status not-listening';
      startButton.disabled = true;
      return;
    }

    // Check if we're on a chrome:// page
    chrome.tabs.query({active: true, currentWindow: true}, function(tabs) {
      if (tabs[0] && tabs[0].url.startsWith('chrome://')) {
        statusText.textContent = 'Voice navigation is not available on chrome:// pages';
        statusText.className = 'status not-listening';
        startButton.disabled = true;
        toggleTTSButton.disabled = true;
        toggleCursorButton.disabled = true;
        return;
      }

      // Check TTS and cursor reading status
      chrome.runtime.sendMessage({action: 'checkTTSStatus'}, (response) => {
        if (response) {
          if (response.enabled) {
            toggleTTSButton.textContent = 'Disable Text-to-Speech';
            toggleTTSButton.classList.add('active');
            ttsStatusText.textContent = 'TTS is enabled';
          }
          if (response.cursorEnabled) {
            toggleCursorButton.textContent = 'Disable Cursor Reading';
            toggleCursorButton.classList.add('active');
            ttsStatusText.textContent = response.enabled ? 'TTS and cursor reading enabled' : 'Cursor reading enabled';
          }
        }
      });
    });

    statusText.textContent = 'Ready to listen';
    statusText.className = 'status not-listening';
  }

  initialize();

  // Start listening button
  startButton.addEventListener('click', async () => {
    statusText.textContent = 'Starting...';
    try {
      const response = await chrome.runtime.sendMessage({action: 'startListening'});
      if (response.status === 'success') {
        statusText.textContent = 'Listening...';
        statusText.className = 'status listening';
        startButton.disabled = true;
        stopButton.disabled = false;
      } else {
        statusText.textContent = `Error: ${response.message}`;
        statusText.className = 'status not-listening';
      }
    } catch (error) {
      console.error('Error starting listening:', error);
      statusText.textContent = 'Error: Could not start listening';
      statusText.className = 'status not-listening';
    }
  });

  // Stop listening button
  stopButton.addEventListener('click', async () => {
    statusText.textContent = 'Stopping...';
    try {
      const response = await chrome.runtime.sendMessage({action: 'stopListening'});
      if (response.status === 'success') {
        statusText.textContent = 'Stopped listening';
        statusText.className = 'status not-listening';
        startButton.disabled = false;
        stopButton.disabled = true;
      } else {
        statusText.textContent = `Error: ${response.message}`;
        statusText.className = 'status not-listening';
      }
    } catch (error) {
      console.error('Error stopping listening:', error);
      statusText.textContent = 'Error: Could not stop listening';
      statusText.className = 'status not-listening';
    }
  });

  // Toggle TTS button
  toggleTTSButton.addEventListener('click', async () => {
    const isEnabled = toggleTTSButton.classList.contains('active');
    try {
      const response = await chrome.runtime.sendMessage({
        action: isEnabled ? 'disableTTS' : 'enableTTS'
      });
      
      if (response.status === 'success') {
        if (isEnabled) {
          toggleTTSButton.textContent = 'Enable Text-to-Speech';
          toggleTTSButton.classList.remove('active');
          ttsStatusText.textContent = toggleCursorButton.classList.contains('active') ? 
            'Cursor reading enabled' : 'TTS is disabled';
        } else {
          toggleTTSButton.textContent = 'Disable Text-to-Speech';
          toggleTTSButton.classList.add('active');
          ttsStatusText.textContent = toggleCursorButton.classList.contains('active') ? 
            'TTS and cursor reading enabled' : 'TTS is enabled';
        }
      } else {
        ttsStatusText.textContent = `Error: ${response.message}`;
      }
    } catch (error) {
      console.error('Error toggling TTS:', error);
      ttsStatusText.textContent = 'Error: Could not toggle TTS';
    }
  });

  // Toggle cursor reading button
  toggleCursorButton.addEventListener('click', async () => {
    const isEnabled = toggleCursorButton.classList.contains('active');
    try {
      const response = await chrome.runtime.sendMessage({
        action: isEnabled ? 'disableCursorReading' : 'enableCursorReading'
      });
      
      if (response.status === 'success') {
        if (isEnabled) {
          toggleCursorButton.textContent = 'Enable Cursor Reading';
          toggleCursorButton.classList.remove('active');
          ttsStatusText.textContent = toggleTTSButton.classList.contains('active') ? 
            'TTS is enabled' : 'TTS is disabled';
        } else {
          toggleCursorButton.textContent = 'Disable Cursor Reading';
          toggleCursorButton.classList.add('active');
          ttsStatusText.textContent = toggleTTSButton.classList.contains('active') ? 
            'TTS and cursor reading enabled' : 'Cursor reading enabled';
        }
      } else {
        ttsStatusText.textContent = `Error: ${response.message}`;
      }
    } catch (error) {
      console.error('Error toggling cursor reading:', error);
      ttsStatusText.textContent = 'Error: Could not toggle cursor reading';
    }
  });

  // Theme selection functionality
  document.querySelectorAll('.theme-option').forEach(option => {
    option.addEventListener('click', async () => {
      const theme = option.dataset.theme;
      
      // Remove active class from all options
      document.querySelectorAll('.theme-option').forEach(opt => {
        opt.classList.remove('active');
      });
      
      // Add active class to selected option
      option.classList.add('active');
      
      try {
        // Query for the active tab
        const tabs = await chrome.tabs.query({active: true, currentWindow: true});
        const activeTab = tabs[0];
        
        if (!activeTab || activeTab.url.startsWith('chrome://')) {
          console.log('Cannot apply theme to chrome:// pages');
          return;
        }

        // First inject the CSS
        await chrome.scripting.insertCSS({
          target: { tabId: activeTab.id },
          files: ['styles.css']
        });

        // Then inject and execute the theme script
        await chrome.scripting.executeScript({
          target: { tabId: activeTab.id },
          files: ['theme.js']
        });

        // Wait a brief moment for the script to initialize
        await new Promise(resolve => setTimeout(resolve, 100));

        // Now send the message to apply the theme
        const response = await chrome.tabs.sendMessage(activeTab.id, {
          action: 'applyTheme',
          theme: theme
        });
        
        if (response && response.success) {
          console.log('Theme applied successfully');
        } else {
          throw new Error('Failed to apply theme');
        }
      } catch (error) {
        console.error('Error applying theme:', error);
      }
    });
  });
}); 