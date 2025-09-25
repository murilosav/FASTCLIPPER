/**
 * Application Constants
 * Centralized configuration for the Twitch Clip Editor Extension
 */

// Extension Information
const EXTENSION_CONFIG = {
    NAME: 'Twitch Clip Editor',
    VERSION: '2.0.0',
    POPUP_ID: 'twitch-clip-editor-popup',
    DRAG_HANDLE_ID: 'clip-editor-drag-handle'
};

// Twitch Selectors - Multiple selectors for robustness
const TWITCH_SELECTORS = {
    CLIP_BUTTON: [
        'button[data-a-target="create-clip-button"]',
        'button[aria-label*="Clip"]',
        'button[data-test-selector="create-clip-button"]',
        'button[title*="Clip"]',
        'button[data-a-target="clip-button"]'
    ],
    
    POPUP_MODALS: [
        'div[role="dialog"]',
        '[data-a-modal="true"]',
        '[data-test-selector="modal"]',
        '.modal-content',
        '.ReactModal__Content',
        '[aria-modal="true"]',
        '.clip-editor-modal',
        '.tw-modal',
        '.modal',
        '.clip-editor-popup',
        '#CLIP_EDITOR_POPUP_ID'
    ],
    
    VIDEO_ELEMENTS: 'video'
};

// Timing Configuration
const TIMING_CONFIG = {
    BUTTON_SEARCH_INTERVAL: 800,
    POPUP_MONITORING_START_DELAY: 300,
    VIDEO_CAPTURE_DELAY: 2500,
    POPUP_HIDE_INTERVAL: 200,
    VIDEO_SEARCH_INTERVAL: 800,
    MAX_VIDEO_SEARCH_ATTEMPTS: 999999,
    FALLBACK_BUTTON_SEARCH_DELAY: 2000
};

// Video Configuration
const VIDEO_CONFIG = {
    SUPPORTED_FORMATS: ['.mp4'],
    SUPPORTED_SOURCES: ['blob:', 'twitchcdn.net'],
    DOWNLOAD_PREFIX: 'twitch-clip-'
};

// Popup Styling Constants
const POPUP_STYLES = {
    Z_INDEX: 2147483647,
    MAX_WIDTH: '90vw',
    VIDEO_WIDTH: '450px',
    BORDER_RADIUS: '16px',
    PADDING: '22px'
};

// CSS Classes
const CSS_CLASSES = {
    POPUP: 'twitch-clip-editor-popup',
    DRAGGING: 'dragging',
    RESPONSIVE: 'responsive',
    HIDDEN: 'hidden'
};

// Messages and Labels
const MESSAGES = {
    SCRIPT_LOADED: 'Twitch Clip Editor - Script loaded!',
    BUTTON_FOUND: 'Clip button found!',
    CLIP_CLICKED: '🎯 Clip button clicked - starting monitoring!',
    MONITORING_START: '🔍 Starting Twitch popup monitoring...',
    MONITORING_STOPPED: '❌ Monitoring stopped',
    POPUP_HIDDEN_VISUALLY: '👻 Hiding Twitch popup VISUALLY (preserving DOM)',
    POPUP_HIDDEN_COMPLETELY: '🗑️ Hiding Twitch popup COMPLETELY after capturing video...',
    VIDEO_CAPTURED: '🎬 Video captured - stopping monitoring',
    DOWNLOAD_STARTED: 'Download started',
    DOWNLOAD_ERROR: 'Error downloading video:'
};

// Export for use in other modules
if (typeof window !== 'undefined') {
    window.TWITCH_CLIP_EDITOR_CONSTANTS = {
        EXTENSION_CONFIG,
        TWITCH_SELECTORS,
        TIMING_CONFIG,
        VIDEO_CONFIG,
        POPUP_STYLES,
        CSS_CLASSES,
        MESSAGES
    };
}