/**
 * Twitch Popup Manager Module
 * Handles hiding and managing Twitch's default clip editor popup
 */

class TwitchPopupManager {
    constructor() {
        this.isMonitoring = false;
        this.monitoringInterval = null;
        
        // Get utilities and constants
        this.constants = window.TWITCH_CLIP_EDITOR_CONSTANTS;
        this.utils = window.TWITCH_CLIP_EDITOR_UTILS;
    }

    /**
     * Start monitoring for Twitch popups
     */
    startMonitoring() {
        if (this.isMonitoring) return;
        
        this.utils.Logger.info(this.constants.MESSAGES.MONITORING_START);
        this.isMonitoring = true;

        // Start monitoring after delay
        setTimeout(() => {
            this.beginPopupMonitoring();
        }, this.constants.TIMING_CONFIG.POPUP_MONITORING_START_DELAY);
    }

    /**
     * Stop monitoring for Twitch popups
     */
    stopMonitoring() {
        this.isMonitoring = false;
        
        if (this.monitoringInterval) {
            clearInterval(this.monitoringInterval);
            this.monitoringInterval = null;
        }
        
        this.utils.Logger.info(this.constants.MESSAGES.MONITORING_STOPPED);
    }

    /**
     * Begin the popup monitoring loop
     */
    beginPopupMonitoring() {
        this.monitoringInterval = setInterval(() => {
            if (!this.isMonitoring) {
                clearInterval(this.monitoringInterval);
                return;
            }
            
            this.hidePopupsVisually();
        }, this.constants.TIMING_CONFIG.POPUP_HIDE_INTERVAL);
    }

    /**
     * Hide Twitch popups visually while preserving DOM structure
     */
    hidePopupsVisually() {
        const selectors = this.constants.TWITCH_SELECTORS.POPUP_MODALS;
        let hiddenCount = 0;

        // Process each selector
        selectors.forEach(selector => {
            const elements = document.querySelectorAll(selector);
            
            elements.forEach(popup => {
                if (this.shouldHidePopup(popup)) {
                    this.hideElementVisually(popup);
                    hiddenCount++;
                }
            });
        });

        // Fallback method for popups not caught by selectors
        if (hiddenCount === 0) {
            this.hidePopupsAlternativeMethod();
        }
    }

    /**
     * Check if popup should be hidden
     * @param {Element} popup - Popup element
     * @returns {boolean}
     */
    shouldHidePopup(popup) {
        const hasVideo = popup.querySelector('video');
        if (!hasVideo) return false;

        const style = window.getComputedStyle(popup);
        
        // Only hide if currently visible
        return (
            style.display !== 'none' && 
            style.opacity !== '0' && 
            style.left !== '-9999px'
        );
    }

    /**
     * Hide element visually while preserving DOM
     * @param {Element} element - Element to hide
     */
    hideElementVisually(element) {
        this.utils.Logger.info(this.constants.MESSAGES.POPUP_HIDDEN_VISUALLY);
        
        this.utils.DOMUtils.applyStyles(element, {
            position: 'absolute',
            left: '-9999px',
            top: '-9999px',
            opacity: '0',
            visibility: 'hidden',
            zIndex: '-1',
            pointerEvents: 'none'
        });
    }

    /**
     * Alternative method to find and hide popups
     */
    hidePopupsAlternativeMethod() {
        const allElements = document.querySelectorAll('*');
        
        allElements.forEach(element => {
            const style = window.getComputedStyle(element);
            const hasVideo = element.querySelector('video');
            
            if (this.isLikelyPopup(element, style, hasVideo)) {
                this.hideElementVisually(element);
            }
        });
    }

    /**
     * Check if element is likely a popup
     * @param {Element} element - Element to check
     * @param {CSSStyleDeclaration} style - Computed style
     * @param {boolean} hasVideo - Whether element contains video
     * @returns {boolean}
     */
    isLikelyPopup(element, style, hasVideo) {
        if (!hasVideo) return false;
        
        const isPositioned = style.position === 'fixed' || style.position === 'absolute';
        const hasHighZIndex = parseInt(style.zIndex) > 1000;
        const hasModalClass = element.classList.toString().includes('modal') || 
                             element.classList.toString().includes('popup');
        const isVisible = style.display !== 'none' && 
                         style.opacity !== '0' && 
                         style.left !== '-9999px';
        
        return isPositioned && (hasHighZIndex || hasModalClass) && isVisible;
    }

    /**
     * Completely hide Twitch popups after video capture
     */
    hidePopupsCompletely() {
        this.utils.Logger.info(this.constants.MESSAGES.POPUP_HIDDEN_COMPLETELY);
        
        const selectors = this.constants.TWITCH_SELECTORS.POPUP_MODALS;
        let hiddenCount = 0;

        selectors.forEach(selector => {
            const elements = document.querySelectorAll(selector);
            
            elements.forEach(popup => {
                const hasVideo = popup.querySelector('video');
                
                if (hasVideo) {
                    this.hideElementCompletely(popup);
                    hiddenCount++;
                }
            });
        });

        this.utils.Logger.info(`✅ ${hiddenCount} popups hidden completely`);

        // Fallback for missed popups
        if (hiddenCount === 0) {
            this.hidePopupsCompletelyAlternative();
        }
    }

    /**
     * Hide element completely
     * @param {Element} element - Element to hide
     */
    hideElementCompletely(element) {
        this.utils.DOMUtils.applyStyles(element, {
            display: 'none',
            visibility: 'hidden',
            zIndex: '-1',
            opacity: '0',
            transform: 'translateX(-9999px)'
        });
    }

    /**
     * Alternative method to completely hide popups
     */
    hidePopupsCompletelyAlternative() {
        const allElements = document.querySelectorAll('*');
        let hiddenCount = 0;
        
        allElements.forEach(element => {
            const style = window.getComputedStyle(element);
            const hasVideo = element.querySelector('video');
            
            if (this.isLikelyPopup(element, style, hasVideo)) {
                this.hideElementCompletely(element);
                hiddenCount++;
            }
        });
        
        this.utils.Logger.info(`Alternative method hidden ${hiddenCount} elements`);
    }

    /**
     * Get monitoring status
     * @returns {boolean}
     */
    getMonitoringStatus() {
        return this.isMonitoring;
    }

    /**
     * Cleanup resources
     */
    cleanup() {
        this.stopMonitoring();
    }
}

// Export for use in main content script
if (typeof window !== 'undefined') {
    window.TwitchPopupManager = TwitchPopupManager;
}