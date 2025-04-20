// Handle extension installation
chrome.runtime.onInstalled.addListener(() => {
  console.log('Voice Navigator extension installed');
});

// Global state for TTS
let ttsEnabled = false;
let cursorReadingEnabled = false;
let lastSelection = '';
let lastCursorText = '';
let selectionCheckInterval = null;
let cursorCheckInterval = null;

// Function to get text at cursor position
function getTextAtCursor() {
  return {
    func: () => {
      function cleanText(text) {
        // Remove extra whitespace and normalize spaces
        text = text.replace(/\s+/g, ' ').trim();
        // Remove common HTML artifacts that might slip through
        text = text.replace(/[<>{}]/g, '');
        // Limit text length to approximately 150 characters, trying to break at sentence or word boundary
        if (text.length > 150) {
          let truncated = text.substring(0, 150);
          // Try to break at sentence end
          let sentenceBreak = truncated.match(/[.!?][^.!?]*$/);
          if (sentenceBreak) {
            truncated = text.substring(0, sentenceBreak.index + 1);
          } else {
            // If no sentence break, try to break at last word
            let lastSpace = truncated.lastIndexOf(' ');
            if (lastSpace > 0) {
              truncated = truncated.substring(0, lastSpace);
            }
          }
          text = truncated;
        }
        return text;
      }

      function getElementText(element) {
        // For buttons and elements with title, prioritize title attribute
        if (element.tagName === 'BUTTON' || element.tagName === 'INPUT' || element.tagName === 'A') {
          if (element.hasAttribute('title')) {
            return element.getAttribute('title');
          }
          if (element.hasAttribute('aria-label')) {
            return element.getAttribute('aria-label');
          }
        }
        
        // For other elements, use textContent
        return element.textContent;
      }

      function isVisibleElement(element) {
        if (!element) return false;
        const style = window.getComputedStyle(element);
        return style.display !== 'none' && 
               style.visibility !== 'hidden' && 
               style.opacity !== '0' &&
               element.offsetWidth > 0 && 
               element.offsetHeight > 0;
      }

      function isValidTextNode(node) {
        // Check if the node contains actual readable content
        const text = getElementText(node).trim();
        return text.length > 0 && 
               !/^[\s\r\n]*$/.test(text) && // Not just whitespace
               !/^[<>{}[\](),;.!?\\\/]*$/.test(text); // Not just punctuation/symbols
      }

      function findReadableContainer(element) {
        // Skip invisible elements
        if (!isVisibleElement(element)) return null;

        // Skip elements that typically contain non-content
        const skipTags = ['SCRIPT', 'STYLE', 'NOSCRIPT', 'META', 'LINK', 'HEAD', 'SELECT', 'TEXTAREA'];
        if (skipTags.includes(element.tagName)) return null;

        // First try to get the exact element or its immediate parent if it's a text node
        if (element.nodeType === Node.TEXT_NODE) {
          element = element.parentElement;
        }

        // If the element itself has valid text, use it
        if (isValidTextNode(element)) {
          return element;
        }

        // Check if this element is a good container for reading
        const goodContainers = ['P', 'H1', 'H2', 'H3', 'H4', 'H5', 'H6', 'LI', 'TD', 'TH', 'FIGCAPTION', 'LABEL', 'SPAN', 'A', 'BUTTON'];
        if (goodContainers.includes(element.tagName) && isValidTextNode(element)) {
          return element;
        }

        // Look for the nearest parent with readable content, but don't go too far up
        let current = element;
        let depth = 0;
        while (current && depth < 3) {
          if (isValidTextNode(current)) {
            return current;
          }
          current = current.parentElement;
          depth++;
        }

        return null;
      }

      function getElementFromPoint(x, y) {
        // Get all elements at the point (including nested ones)
        const elements = document.elementsFromPoint(x, y);
        
        // Try to find the most appropriate readable element
        for (const element of elements) {
          const container = findReadableContainer(element);
          if (container) {
            return {
              element: container,
              text: getElementText(container)
            };
          }
        }
        
        return null;
      }

      // Set up cursor position tracking if not already set
      if (!window.cursorTracker) {
        window.cursorTracker = {
          x: 0,
          y: 0,
          lastElement: null
        };

        document.addEventListener('mousemove', (e) => {
          window.cursorTracker.x = e.clientX;
          window.cursorTracker.y = e.clientY;
        });
      }

      // Get text at current cursor position
      const result = getElementFromPoint(window.cursorTracker.x, window.cursorTracker.y);
      
      // Only update if we've moved to a different element
      if (result && result.element !== window.cursorTracker.lastElement) {
        window.cursorTracker.lastElement = result.element;
        return cleanText(result.text);
      }

      return ''; // Return empty string if no new text to read
    }
  };
}

// Function to check for cursor position changes
function setupCursorCheck(tabId) {
  if (cursorCheckInterval) {
    clearInterval(cursorCheckInterval);
  }

  if (!cursorReadingEnabled) return;

  // Initialize cursor tracking
  chrome.scripting.executeScript({
    target: { tabId },
    func: () => {
      // Initialize cursor tracker if not exists
      if (!window.cursorTracker) {
        window.cursorTracker = {
          x: 0,
          y: 0,
          lastElement: null
        };

        document.addEventListener('mousemove', (e) => {
          window.cursorTracker.x = e.clientX;
          window.cursorTracker.y = e.clientY;
        });
      }
    }
  });

  cursorCheckInterval = setInterval(() => {
    if (!cursorReadingEnabled) {
      clearInterval(cursorCheckInterval);
      return;
    }

    chrome.scripting.executeScript({
      target: { tabId },
      ...getTextAtCursor()
    }).then((results) => {
      if (results && results[0] && results[0].result) {
        const currentText = results[0].result;
        if (currentText && currentText !== lastCursorText && currentText.length > 1) {
          lastCursorText = currentText;
          speakText(currentText, tabId);
        }
      }
    }).catch((error) => {
      console.error('Error checking cursor:', error);
    });
  }, 300); // Check every 300ms for better responsiveness
}

// Function to check for text selection changes
function setupSelectionCheck(tabId) {
  if (selectionCheckInterval) {
    clearInterval(selectionCheckInterval);
  }

  if (!ttsEnabled) return;

  selectionCheckInterval = setInterval(() => {
    if (!ttsEnabled) {
      clearInterval(selectionCheckInterval);
      return;
    }

    chrome.scripting.executeScript({
      target: { tabId },
      func: () => {
        const selection = window.getSelection().toString().trim();
        return selection;
      }
    }).then((results) => {
      if (results && results[0] && results[0].result) {
        const currentSelection = results[0].result;
        if (currentSelection && currentSelection !== lastSelection) {
          lastSelection = currentSelection;
          speakText(currentSelection, tabId);
        }
      }
    }).catch((error) => {
      console.error('Error checking selection:', error);
    });
  }, 1000);
}

// Function to speak text
function speakText(text, tabId) {
  chrome.scripting.executeScript({
    target: { tabId },
    func: (textToSpeak) => {
      // Cancel any ongoing speech
      window.speechSynthesis.cancel();

      if (!textToSpeak) return;

      // Create and configure speech utterance
      const utterance = new SpeechSynthesisUtterance(textToSpeak);
      utterance.lang = 'en-US';
      utterance.rate = 0.9;  // Slower speech rate
      utterance.pitch = 1.0;
      utterance.volume = 1.0;

      // Start speaking
      window.speechSynthesis.speak(utterance);
    },
    args: [text]
  });
}

// Handle messages from popup
chrome.runtime.onMessage.addListener((request, sender, sendResponse) => {
  if (request.action === 'enableCursorReading') {
    chrome.tabs.query({active: true, currentWindow: true}, function(tabs) {
      if (tabs[0]) {
        if (tabs[0].url.startsWith('chrome://')) {
          sendResponse({status: 'error', message: 'Cursor reading is not available on chrome:// pages'});
          return;
        }
        cursorReadingEnabled = true;
        setupCursorCheck(tabs[0].id);
        sendResponse({status: 'success'});
      }
    });
    return true;
  }
  else if (request.action === 'disableCursorReading') {
    cursorReadingEnabled = false;
    if (cursorCheckInterval) {
      clearInterval(cursorCheckInterval);
      cursorCheckInterval = null;
    }
    lastCursorText = '';
    chrome.tabs.query({active: true, currentWindow: true}, function(tabs) {
      if (tabs[0]) {
        // Stop any ongoing speech
        chrome.scripting.executeScript({
          target: { tabId: tabs[0].id },
          func: () => {
            window.speechSynthesis.cancel();
          }
        });
      }
    });
    sendResponse({status: 'success'});
    return true;
  }
  else if (request.action === 'enableTTS') {
    chrome.tabs.query({active: true, currentWindow: true}, function(tabs) {
      if (tabs[0]) {
        if (tabs[0].url.startsWith('chrome://')) {
          sendResponse({status: 'error', message: 'TTS is not available on chrome:// pages'});
          return;
        }
        ttsEnabled = true;
        setupSelectionCheck(tabs[0].id);
        sendResponse({status: 'success'});
      }
    });
    return true;
  } 
  else if (request.action === 'disableTTS') {
    ttsEnabled = false;
    if (selectionCheckInterval) {
      clearInterval(selectionCheckInterval);
      selectionCheckInterval = null;
    }
    lastSelection = '';
    chrome.tabs.query({active: true, currentWindow: true}, function(tabs) {
      if (tabs[0]) {
        // Stop any ongoing speech
        chrome.scripting.executeScript({
          target: { tabId: tabs[0].id },
          func: () => {
            window.speechSynthesis.cancel();
          }
        });
      }
    });
    sendResponse({status: 'success'});
    return true;
  }
  else if (request.action === 'checkTTSStatus') {
    sendResponse({
      enabled: ttsEnabled,
      cursorEnabled: cursorReadingEnabled
    });
    return true;
  }
  else if (request.action === 'startListening') {
    chrome.tabs.query({active: true, currentWindow: true}, function(tabs) {
      if (tabs[0]) {
        // Check if the URL is a chrome:// URL
        if (tabs[0].url.startsWith('chrome://')) {
          sendResponse({status: 'error', message: 'Voice navigation is not available on chrome:// pages'});
          return;
        }

        // Inject the content script
        chrome.scripting.executeScript({
          target: {tabId: tabs[0].id},
          func: () => {
            // Check if speech recognition is supported
            if (!('webkitSpeechRecognition' in window) && !('SpeechRecognition' in window)) {
              return {status: 'error', message: 'Speech recognition not supported'};
            }

            // Initialize speech recognition
            const recognition = new (window.SpeechRecognition || window.webkitSpeechRecognition)();
            recognition.continuous = true;
            recognition.interimResults = true;
            recognition.lang = 'en-US';

            // Set up event handlers
            recognition.onstart = () => {
              console.log('Speech recognition started');
            };

            recognition.onerror = (event) => {
              console.error('Speech recognition error:', event.error);
            };

            recognition.onresult = (event) => {
              const transcript = event.results[event.results.length - 1][0].transcript.toLowerCase();
              console.log('Recognized speech:', transcript);

              // Handle commands
              if (transcript.includes('open')) {
                const website = transcript.split('open')[1].trim();
                const websites = {
                  'google': 'https://www.google.com',
                  'youtube': 'https://www.youtube.com',
                  'facebook': 'https://www.facebook.com',
                  'twitter': 'https://www.twitter.com',
                  'amazon': 'https://www.amazon.com',
                  'github': 'https://www.github.com',
                  'linkedin': 'https://www.linkedin.com'
                };
                const url = websites[website];
                if (url) {
                  window.open(url, '_blank');
                }
              } else if (transcript.includes('scroll')) {
                const direction = transcript.includes('up') ? 'up' : 'down';
                const scrollAmount = 200;
                window.scrollBy(0, direction === 'up' ? -scrollAmount : scrollAmount);
              } else if (transcript.includes('refresh')) {
                window.location.reload();
              } else if (transcript.includes('click')) {
                const target = transcript.split('click')[1].trim();
                const elements = document.querySelectorAll('a, button');
                for (const element of elements) {
                  if (element.textContent.toLowerCase().includes(target.toLowerCase())) {
                    element.click();
                    break;
                  }
                }
              }
            };

            try {
              recognition.start();
              return {status: 'success'};
            } catch (error) {
              return {status: 'error', message: error.message};
            }
          }
        }).then((results) => {
          if (results && results[0] && results[0].result) {
            sendResponse(results[0].result);
          } else {
            sendResponse({status: 'error', message: 'Failed to start recognition'});
          }
        }).catch((error) => {
          console.error('Error:', error);
          sendResponse({status: 'error', message: error.message});
        });
      }
    });
    return true;
  }
  else if (request.action === 'stopListening') {
    chrome.tabs.query({active: true, currentWindow: true}, function(tabs) {
      if (tabs[0]) {
        // Check if the URL is a chrome:// URL
        if (tabs[0].url.startsWith('chrome://')) {
          sendResponse({status: 'error', message: 'Voice navigation is not available on chrome:// pages'});
          return;
        }

        chrome.scripting.executeScript({
          target: {tabId: tabs[0].id},
          func: () => {
            const recognition = window.recognition;
            if (recognition) {
              recognition.stop();
              return {status: 'success'};
            }
            return {status: 'error', message: 'No recognition instance found'};
          }
        }).then((results) => {
          if (results && results[0] && results[0].result) {
            sendResponse(results[0].result);
          } else {
            sendResponse({status: 'error', message: 'Failed to stop recognition'});
          }
        }).catch((error) => {
          console.error('Error:', error);
          sendResponse({status: 'error', message: error.message});
        });
      }
    });
    return true;
  }
}); 