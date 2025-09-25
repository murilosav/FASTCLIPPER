/**
 * Utility Functions
 * Reusable helper functions for the Twitch Clip Editor Extension
 */

/**
 * Logger utility with consistent formatting
 */
const Logger = {
    info: (message, ...args) => {
        console.log(`[Twitch Clip Editor] ${message}`, ...args);
    },
    
    warn: (message, ...args) => {
        console.warn(`[Twitch Clip Editor] ${message}`, ...args);
    },
    
    error: (message, ...args) => {
        console.error(`[Twitch Clip Editor] ${message}`, ...args);
    }
};

/**
 * DOM utility functions
 */
const DOMUtils = {
    /**
     * Wait for element to appear in DOM
     * @param {string|string[]} selectors - CSS selector(s) to search for
     * @param {number} timeout - Timeout in milliseconds
     * @returns {Promise<Element>}
     */
    waitForElement: (selectors, timeout = 10000) => {
        return new Promise((resolve, reject) => {
            const selectorArray = Array.isArray(selectors) ? selectors : [selectors];
            let attempts = 0;
            const maxAttempts = timeout / 100;
            
            const search = () => {
                attempts++;
                
                for (const selector of selectorArray) {
                    const element = document.querySelector(selector);
                    if (element) {
                        resolve(element);
                        return;
                    }
                }
                
                if (attempts >= maxAttempts) {
                    reject(new Error(`Element not found after ${timeout}ms`));
                    return;
                }
                
                setTimeout(search, 100);
            };
            
            search();
        });
    },

    /**
     * Find element using multiple selectors
     * @param {string[]} selectors - Array of CSS selectors
     * @returns {Element|null}
     */
    findBySelectors: (selectors) => {
        for (const selector of selectors) {
            const element = document.querySelector(selector);
            if (element) return element;
        }
        return null;
    },

    /**
     * Remove element safely
     * @param {string} id - Element ID
     */
    removeElement: (id) => {
        const element = document.getElementById(id);
        if (element) {
            element.remove();
            return true;
        }
        return false;
    },

    /**
     * Add CSS styles to element
     * @param {Element} element - DOM element
     * @param {Object} styles - Style object
     */
    applyStyles: (element, styles) => {
        Object.assign(element.style, styles);
    },

    /**
     * Create element with attributes and styles
     * @param {string} tag - HTML tag name
     * @param {Object} options - Options object
     * @returns {Element}
     */
    createElement: (tag, options = {}) => {
        const element = document.createElement(tag);
        
        if (options.id) element.id = options.id;
        if (options.className) element.className = options.className;
        if (options.innerHTML) element.innerHTML = options.innerHTML;
        if (options.textContent) element.textContent = options.textContent;
        if (options.attributes) {
            Object.entries(options.attributes).forEach(([key, value]) => {
                element.setAttribute(key, value);
            });
        }
        if (options.styles) {
            DOMUtils.applyStyles(element, options.styles);
        }
        
        return element;
    }
};

/**
 * Video utility functions
 */
const VideoUtils = {
    /**
     * Check if video source is valid
     * @param {string} src - Video source URL
     * @returns {boolean}
     */
    isValidVideoSource: (src) => {
        const { SUPPORTED_FORMATS, SUPPORTED_SOURCES } = window.TWITCH_CLIP_EDITOR_CONSTANTS.VIDEO_CONFIG;
        
        if (!src) return false;
        
        // Check formats
        const hasValidFormat = SUPPORTED_FORMATS.some(format => src.endsWith(format));
        if (hasValidFormat) return true;
        
        // Check sources
        return SUPPORTED_SOURCES.some(source => src.includes(source));
    },

    /**
     * Find all valid video elements on page
     * @returns {Element[]}
     */
    findValidVideos: () => {
        const videos = Array.from(document.querySelectorAll('video'));
        return videos.filter(video => VideoUtils.isValidVideoSource(video.src));
    },

    /**
     * Generate filename for clip
     * @returns {string}
     */
    generateFilename: () => {
        const { DOWNLOAD_PREFIX } = window.TWITCH_CLIP_EDITOR_CONSTANTS.VIDEO_CONFIG;
        return `${DOWNLOAD_PREFIX}${Date.now()}.mp4`;
    }
};

/**
 * Event utility functions
 */
const EventUtils = {
    /**
     * Debounce function execution
     * @param {Function} func - Function to debounce
     * @param {number} wait - Wait time in milliseconds
     * @returns {Function}
     */
    debounce: (func, wait) => {
        let timeout;
        return function executedFunction(...args) {
            const later = () => {
                clearTimeout(timeout);
                func(...args);
            };
            clearTimeout(timeout);
            timeout = setTimeout(later, wait);
        };
    },

    /**
     * Throttle function execution
     * @param {Function} func - Function to throttle
     * @param {number} limit - Time limit in milliseconds
     * @returns {Function}
     */
    throttle: (func, limit) => {
        let inThrottle;
        return function() {
            const args = arguments;
            const context = this;
            if (!inThrottle) {
                func.apply(context, args);
                inThrottle = true;
                setTimeout(() => inThrottle = false, limit);
            }
        };
    }
};

/**
 * Storage utility functions
 */
const StorageUtils = {
    /**
     * Get value from local storage
     * @param {string} key - Storage key
     * @param {*} defaultValue - Default value if key doesn't exist
     * @returns {*}
     */
    get: (key, defaultValue = null) => {
        try {
            const value = localStorage.getItem(`twitch-clip-editor-${key}`);
            return value ? JSON.parse(value) : defaultValue;
        } catch (error) {
            Logger.error('Storage get error:', error);
            return defaultValue;
        }
    },

    /**
     * Set value in local storage
     * @param {string} key - Storage key
     * @param {*} value - Value to store
     */
    set: (key, value) => {
        try {
            localStorage.setItem(`twitch-clip-editor-${key}`, JSON.stringify(value));
        } catch (error) {
            Logger.error('Storage set error:', error);
        }
    }
};

// Export utilities
if (typeof window !== 'undefined') {
    window.TWITCH_CLIP_EDITOR_UTILS = {
        Logger,
        DOMUtils,
        VideoUtils,
        EventUtils,
        StorageUtils
    };
}