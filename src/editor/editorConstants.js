/**
 * Video Editor Constants
 * Extended constants for the advanced video editor
 */

// Extend existing constants with editor-specific configurations
const EDITOR_CONSTANTS = {
    // Canvas Configuration
    CANVAS: {
        LANDSCAPE_ASPECT_RATIO: 16 / 9,
        PORTRAIT_ASPECT_RATIO: 9 / 16,
        MAX_WIDTH: 800,
        MAX_HEIGHT: 450,
        PREVIEW_WIDTH: 270,
        PREVIEW_HEIGHT: 480
    },

    // Selection Configuration
    SELECTION: {
        MIN_WIDTH: 50,
        MIN_HEIGHT: 50,
        DEFAULT_WIDTH_PERCENT: 0.4,
        DEFAULT_HEIGHT_PERCENT: 0.7,
        BORDER_WIDTH: 3,
        BORDER_COLOR: '#00D4FF',
        HANDLE_SIZE: 12,
        ZOOM_SENSITIVITY: 0.1,
        MIN_ZOOM: 0.3,
        MAX_ZOOM: 3.0
    },

    // Recording Configuration
    RECORDING: {
        KEYFRAME_INTERVAL: 33, // ~30fps
        AUTO_KEYFRAME: true,
        SMOOTHING: true,
        EXPORT_FORMAT: 'webm',
        EXPORT_QUALITY: 1.0
    },

    // Timeline Configuration
    TIMELINE: {
        HEIGHT: 60,
        SCRUBBER_WIDTH: 3,
        SCRUBBER_COLOR: '#FF6B6B',
        KEYFRAME_INDICATOR_SIZE: 6,
        KEYFRAME_COLOR: '#4ECDC4'
    },

    // Editor Modes
    MODES: {
        PREVIEW: 'preview',
        RECORD: 'record',
        EDIT: 'edit',
        EXPORT: 'export'
    },

    // Export Configuration
    EXPORT: {
        WIDTH: 1080,
        HEIGHT: 1920,
        FRAME_RATE: 30,
        BITRATE: 5000000, // 5Mbps
        CODEC: 'h264'
    }
};

// CSS Classes for Editor
const EDITOR_CSS_CLASSES = {
    EDITOR_CONTAINER: 'video-editor-container',
    LANDSCAPE_CANVAS: 'landscape-canvas',
    PORTRAIT_CANVAS: 'portrait-canvas',
    SELECTION_BOX: 'selection-box',
    TIMELINE: 'editor-timeline',
    CONTROLS: 'editor-controls',
    RECORDING: 'recording-mode',
    EXPORTING: 'exporting-mode'
};

// Editor Messages
const EDITOR_MESSAGES = {
    EDITOR_INITIALIZED: 'Video Editor initialized successfully',
    RECORDING_STARTED: '🔴 Recording started',
    RECORDING_STOPPED: '⏹️ Recording stopped',
    KEYFRAME_SAVED: '📝 Keyframe saved',
    EXPORT_STARTED: '🎬 Export started',
    EXPORT_COMPLETED: '✅ Export completed',
    EXPORT_FAILED: '❌ Export failed'
};

// Export for use in editor modules
if (typeof window !== 'undefined') {
    window.EDITOR_CONSTANTS = EDITOR_CONSTANTS;
    window.EDITOR_CSS_CLASSES = EDITOR_CSS_CLASSES;
    window.EDITOR_MESSAGES = EDITOR_MESSAGES;
}