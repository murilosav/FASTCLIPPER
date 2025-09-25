/**
 * Clip Detector Module
 * Handles detection and binding of Twitch clip button clicks
 */

class ClipDetector {
    constructor() {
        this.isMonitoring = false;
        this.clipButton = null;
        this.eventListeners = new Map();
        
        // Get utilities and constants
        this.constants = window.TWITCH_CLIP_EDITOR_CONSTANTS;
        this.utils = window.TWITCH_CLIP_EDITOR_UTILS;
        
        this.utils.Logger.info(this.constants.MESSAGES.SCRIPT_LOADED);
    }

    /**
     * Initialize clip button detection
     */
    initialize() {
        this.waitForClipButton();
        
        // Fallback search in case initial search fails
        setTimeout(() => {
            if (!this.clipButton) {
                this.waitForClipButton();
            }
        }, this.constants.TIMING_CONFIG.FALLBACK_BUTTON_SEARCH_DELAY);
    }

    /**
     * Wait for clip button to appear and bind click event
     */
    waitForClipButton() {
        let attempts = 0;
        const interval = setInterval(() => {
            attempts++;
            
            const button = this.findClipButton();
            if (button) {
                clearInterval(interval);
                this.bindClipButton(button);
                this.utils.Logger.info(this.constants.MESSAGES.BUTTON_FOUND);
            }
            
            // Continue searching indefinitely (ads can be long)
        }, this.constants.TIMING_CONFIG.BUTTON_SEARCH_INTERVAL);

        // Store interval for cleanup if needed
        this.buttonSearchInterval = interval;
    }

    /**
     * Find clip button using multiple selectors
     * @returns {Element|null}
     */
    findClipButton() {
        return this.utils.DOMUtils.findBySelectors(
            this.constants.TWITCH_SELECTORS.CLIP_BUTTON
        );
    }

    /**
     * Bind click event to clip button
     * @param {Element} button - Clip button element
     */
    bindClipButton(button) {
        // Remove previous event listener if exists
        if (this.clipButton && this.eventListeners.has('clipClick')) {
            this.clipButton.removeEventListener('click', this.eventListeners.get('clipClick'), true);
        }

        this.clipButton = button;
        
        // Create and store event listener
        const clickHandler = (event) => this.handleClipClick(event);
        this.eventListeners.set('clipClick', clickHandler);
        
        // Bind click event with capture phase for better reliability
        button.addEventListener('click', clickHandler, true);
    }

    /**
     * Handle clip button click
     * @param {Event} event - Click event
     */
    handleClipClick(event) {
        this.utils.Logger.info(this.constants.MESSAGES.CLIP_CLICKED);
        
        // Emit custom event for other modules to listen
        const clipEvent = new CustomEvent('twitchClipRequested', {
            detail: {
                originalEvent: event,
                timestamp: Date.now()
            }
        });
        
        document.dispatchEvent(clipEvent);
    }

    /**
     * Get current monitoring status
     * @returns {boolean}
     */
    getMonitoringStatus() {
        return this.isMonitoring;
    }

    /**
     * Set monitoring status
     * @param {boolean} status - Monitoring status
     */
    setMonitoringStatus(status) {
        this.isMonitoring = status;
    }

    /**
     * Cleanup event listeners and intervals
     */
    cleanup() {
        // Clear button search interval
        if (this.buttonSearchInterval) {
            clearInterval(this.buttonSearchInterval);
        }

        // Remove all event listeners
        this.eventListeners.forEach((listener, event) => {
            if (this.clipButton && event === 'clipClick') {
                this.clipButton.removeEventListener('click', listener, true);
            }
        });

        this.eventListeners.clear();
        this.clipButton = null;
        this.isMonitoring = false;
    }

    /**
     * Restart clip button detection (useful for SPA navigation)
     */
    restart() {
        this.cleanup();
        this.initialize();
    }
}

// Export for use in main content script
if (typeof window !== 'undefined') {
    window.TwitchClipDetector = ClipDetector;
}