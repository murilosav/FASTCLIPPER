/**
 * Main Content Script
 * Coordinates all modules and handles the main application flow
 */

class TwitchClipEditor {
    constructor() {
        // Initialize module instances
        this.clipDetector = null;
        this.popupManager = null;
        this.videoDownloader = null;
        this.twitchPopupManager = null;
        
        // State management
        this.isInitialized = false;
        this.currentState = 'idle'; // idle, monitoring, capturing, ready
        
        // Get utilities and constants
        this.constants = window.TWITCH_CLIP_EDITOR_CONSTANTS;
        this.utils = window.TWITCH_CLIP_EDITOR_UTILS;
        
        // Bind methods
        this.handleClipRequest = this.handleClipRequest.bind(this);
        this.handlePageNavigation = this.handlePageNavigation.bind(this);
    }

    /**
     * Initialize the extension
     */
    async initialize() {
        if (this.isInitialized) return;

        try {
            this.utils.Logger.info('Initializing Twitch Clip Editor...');
            
            // Initialize modules
            this.initializeModules();
            
            // Set up event listeners
            this.attachEventListeners();
            
            // Start clip button detection
            this.clipDetector.initialize();
            
            this.isInitialized = true;
            this.utils.Logger.info('Twitch Clip Editor initialized successfully');
            
        } catch (error) {
            this.utils.Logger.error('Failed to initialize Twitch Clip Editor:', error);
        }
    }

    /**
     * Initialize all module instances
     */
    initializeModules() {
        // Check if all required classes are available
        if (!window.TwitchClipDetector || 
            !window.PopupManager || 
            !window.VideoDownloader || 
            !window.TwitchPopupManager) {
            throw new Error('Required modules not loaded');
        }

        this.clipDetector = new window.TwitchClipDetector();
        this.popupManager = new window.PopupManager();
        this.videoDownloader = new window.VideoDownloader();
        this.twitchPopupManager = new window.TwitchPopupManager();

        // Make videoDownloader globally accessible for popup
        window.videoDownloader = this.videoDownloader;
    }

    /**
     * Attach global event listeners
     */
    attachEventListeners() {
        // Listen for clip requests from clip detector
        document.addEventListener('twitchClipRequested', this.handleClipRequest);

        // Listen for SPA navigation changes
        window.addEventListener('popstate', this.handlePageNavigation);
        
        // Listen for URL changes (for SPA navigation)
        const originalPushState = history.pushState;
        const originalReplaceState = history.replaceState;
        
        history.pushState = (...args) => {
            originalPushState.apply(history, args);
            setTimeout(this.handlePageNavigation, 100);
        };
        
        history.replaceState = (...args) => {
            originalReplaceState.apply(history, args);
            setTimeout(this.handlePageNavigation, 100);
        };

        // Listen for beforeunload to cleanup
        window.addEventListener('beforeunload', () => {
            this.cleanup();
        });
    }

    /**
     * Handle clip request from user
     * @param {CustomEvent} event - Clip request event
     */
    async handleClipRequest(event) {
        try {
            this.utils.Logger.info('Handling clip request...');
            this.currentState = 'monitoring';

            // Start monitoring Twitch popup
            this.twitchPopupManager.startMonitoring();

            // Wait for video capture delay then start capturing
            setTimeout(async () => {
                await this.captureVideo();
            }, this.constants.TIMING_CONFIG.VIDEO_CAPTURE_DELAY);

        } catch (error) {
            this.utils.Logger.error('Error handling clip request:', error);
            this.showErrorPopup();
        }
    }

    /**
     * Capture video from the page
     */
    async captureVideo() {
        try {
            this.currentState = 'capturing';
            
            // Try to find and capture video
            const videoSrc = await this.videoDownloader.searchForVideo();
            
            if (videoSrc) {
                this.utils.Logger.info('Video captured successfully');
                this.currentState = 'ready';
                
                // Stop monitoring Twitch popup
                this.twitchPopupManager.stopMonitoring();
                
                // Hide Twitch popup completely
                this.twitchPopupManager.hidePopupsCompletely();
                
                // Show our custom popup
                this.popupManager.createPopup(videoSrc);
                
            } 
            
        } catch (error) {
            this.utils.Logger.warn('Could not capture video:', error);
            this.currentState = 'idle';
            
            // Stop monitoring
            this.twitchPopupManager.stopMonitoring();
            
            // Show fallback popup
            if (!error.message.includes('Video not found after')) {
                this.showFallbackPopup();
            }
        }
    }

    /**
     * Show fallback popup when video capture fails
     */
    showFallbackPopup() {
        this.popupManager.createFallbackPopup();
    }

    /**
     * Show error popup
     */
    showErrorPopup() {
        this.popupManager.createFallbackPopup();
        this.currentState = 'idle';
    }

    /**
     * Handle page navigation (SPA routing)
     */
    handlePageNavigation() {
        // Small delay to let the new page load
        setTimeout(() => {
            if (this.isOnTwitchStream()) {
                this.utils.Logger.info('Navigation detected - restarting clip detection');
                this.restartClipDetection();
            }
        }, 1000);
    }

    /**
     * Check if current page is a Twitch stream
     * @returns {boolean}
     */
    isOnTwitchStream() {
        const url = window.location.href;
        return url.includes('twitch.tv/') && 
               !url.includes('/directory/') && 
               !url.includes('/settings/') &&
               !url.includes('/following/');
    }

    /**
     * Restart clip detection (useful after navigation)
     */
    restartClipDetection() {
        if (this.clipDetector) {
            this.clipDetector.restart();
        }
    }

    /**
     * Get current application state
     * @returns {string}
     */
    getCurrentState() {
        return this.currentState;
    }

    /**
     * Reset state to idle
     */
    resetState() {
        this.currentState = 'idle';
    }

    /**
     * Check if extension is initialized
     * @returns {boolean}
     */
    getInitializationStatus() {
        return this.isInitialized;
    }

    /**
     * Get module instances for debugging
     * @returns {Object}
     */
    getModules() {
        return {
            clipDetector: this.clipDetector,
            popupManager: this.popupManager,
            videoDownloader: this.videoDownloader,
            twitchPopupManager: this.twitchPopupManager
        };
    }

    /**
     * Cleanup resources
     */
    cleanup() {
        this.utils.Logger.info('Cleaning up Twitch Clip Editor...');
        
        if (this.clipDetector) {
            this.clipDetector.cleanup();
        }
        
        if (this.popupManager) {
            this.popupManager.cleanup();
        }
        
        if (this.videoDownloader) {
            this.videoDownloader.cleanup();
        }
        
        if (this.twitchPopupManager) {
            this.twitchPopupManager.cleanup();
        }

        // Remove event listeners
        document.removeEventListener('twitchClipRequested', this.handleClipRequest);
        window.removeEventListener('popstate', this.handlePageNavigation);

        this.isInitialized = false;
        this.currentState = 'idle';
    }

    /**
     * Restart the entire extension
     */
    restart() {
        this.cleanup();
        setTimeout(() => {
            this.initialize();
        }, 500);
    }
}

// Initialize the extension when DOM is ready
function initializeExtension() {
    // Check if all dependencies are loaded
    if (!window.TWITCH_CLIP_EDITOR_CONSTANTS || 
        !window.TWITCH_CLIP_EDITOR_UTILS ||
        !window.TwitchClipDetector ||
        !window.PopupManager ||
        !window.VideoDownloader ||
        !window.TwitchPopupManager) {
        
        // Retry after a short delay
        setTimeout(initializeExtension, 100);
        return;
    }

    // Create global instance
    window.twitchClipEditor = new TwitchClipEditor();
    
    // Initialize
    window.twitchClipEditor.initialize();
}

// Start initialization
if (document.readyState === 'loading') {
    document.addEventListener('DOMContentLoaded', initializeExtension);
} else {
    initializeExtension();
}

// Fallback initialization
setTimeout(initializeExtension, 2000);