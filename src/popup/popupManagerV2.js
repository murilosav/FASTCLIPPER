/**
 * Updated Popup Manager
 * Enhanced to support advanced video editor mode
 */

// Extend the existing PopupManager class
class PopupManagerV2 extends PopupManager {
    constructor() {
        super();
        this.videoEditor = null;
        this.editorMode = false;
    }

    /**
     * Create popup with advanced editor option
     * @param {string} videoSrc - Video source URL
     */
    createPopup(videoSrc) {
        this.removeExistingPopup();
        this.currentVideo = videoSrc;
        
        const popup = this.buildEnhancedPopupElement(videoSrc);
        this.popup = popup;
        
        document.body.appendChild(popup);
        this.attachEventListeners();
        this.makeResponsive();
        
        // Add entrance animation
        popup.classList.add('entering');
        setTimeout(() => popup.classList.remove('entering'), 300);
    }

    /**
     * Build enhanced popup element with editor option
     * @param {string} videoSrc - Video source URL
     * @returns {Element}
     */
    buildEnhancedPopupElement(videoSrc) {
        const popup = this.utils.DOMUtils.createElement('div', {
            id: this.constants.EXTENSION_CONFIG.POPUP_ID,
            className: this.constants.CSS_CLASSES.POPUP
        });

        popup.innerHTML = `
            <div class="clip-editor-header" id="${this.constants.EXTENSION_CONFIG.DRAG_HANDLE_ID}">
                <div class="clip-editor-title">Clip Editor</div>
                <div class="clip-editor-version">v${this.constants.EXTENSION_CONFIG.VERSION}</div>
            </div>
            <div class="clip-editor-content">
                <div class="clip-editor-video-container">
                    <video 
                        class="clip-editor-video" 
                        src="${videoSrc}" 
                        controls 
                        preload="metadata"
                        playsinline
                        style="display: none;"
                    ></video>
                </div>
                
                <div class="editor-mode-selector">
                    <h4>Choose editing mode:</h4>
                    <div class="mode-buttons">
                        <button class="mode-btn simple-mode active" id="simple-mode">
                            <span class="icon">📹</span>
                            <span class="title">Simple Mode</span>
                            <span class="description">Download video as-is</span>
                        </button>
                        <button class="mode-btn advanced-mode" id="advanced-mode">
                            <span class="icon">🎬</span>
                            <span class="title">Advanced Editor</span>
                            <span class="description">Crop to 9:16 with motion recording</span>
                        </button>
                    </div>
                </div>
                
                <div class="clip-editor-controls" id="simple-controls">
                    <button class="clip-editor-button close" id="close-editor">
                        <span>✕</span> Close
                    </button>
                    <button class="clip-editor-button download" id="download-clip">
                        <span>⬇</span> Download
                    </button>
                </div>
                
                <div class="clip-editor-controls" id="advanced-controls" style="display: none;">
                    <button class="clip-editor-button secondary" id="back-to-simple">
                        <span>←</span> Back
                    </button>
                    <button class="clip-editor-button primary" id="open-editor">
                        <span>🎬</span> Open Advanced Editor
                    </button>
                </div>
            </div>
        `;

        return popup;
    }

    /**
     * Attach event listeners to enhanced popup
     */
    attachEventListeners() {
        // Call parent method first
        super.attachEventListeners();
        
        if (!this.popup) return;

        // Mode selection buttons
        const simpleModeBtn = this.popup.querySelector('#simple-mode');
        const advancedModeBtn = this.popup.querySelector('#advanced-mode');
        const backBtn = this.popup.querySelector('#back-to-simple');
        const openEditorBtn = this.popup.querySelector('#open-editor');

        if (simpleModeBtn) {
            simpleModeBtn.addEventListener('click', () => this.selectMode('simple'));
        }
        
        if (advancedModeBtn) {
            advancedModeBtn.addEventListener('click', () => this.selectMode('advanced'));
        }
        
        if (backBtn) {
            backBtn.addEventListener('click', () => this.selectMode('simple'));
        }
        
        if (openEditorBtn) {
            openEditorBtn.addEventListener('click', () => this.openAdvancedEditor());
        }

        // Show video for simple mode by default
        this.selectMode('simple');
    }

    /**
     * Select editing mode
     * @param {string} mode - Mode to select ('simple' or 'advanced')
     */
    selectMode(mode) {
        if (!this.popup) return;

        const simpleModeBtn = this.popup.querySelector('#simple-mode');
        const advancedModeBtn = this.popup.querySelector('#advanced-mode');
        const simpleControls = this.popup.querySelector('#simple-controls');
        const advancedControls = this.popup.querySelector('#advanced-controls');
        const video = this.popup.querySelector('.clip-editor-video');

        // Update button states
        if (mode === 'simple') {
            simpleModeBtn?.classList.add('active');
            advancedModeBtn?.classList.remove('active');
            simpleControls.style.display = 'flex';
            advancedControls.style.display = 'none';
            video.style.display = 'block';
        } else {
            simpleModeBtn?.classList.remove('active');
            advancedModeBtn?.classList.add('active');
            simpleControls.style.display = 'none';
            advancedControls.style.display = 'flex';
            video.style.display = 'none';
        }
    }

    /**
     * Open advanced video editor
     */
    async openAdvancedEditor() {
        if (!this.currentVideo) {
            this.utils.Logger.error('No video source available for editor');
            return;
        }

        try {
            // Hide current popup
            this.popup.style.display = 'none';

            // Create video element for editor
            const videoElement = document.createElement('video');
            videoElement.crossOrigin = 'anonymous';
            videoElement.preload = 'metadata';

            // Initialize video editor
            this.videoEditor = new window.VideoEditor(videoElement, this.currentVideo);
            await this.videoEditor.initialize();

            // Add editor to page
            document.body.appendChild(this.videoEditor.getContainer());
            this.editorMode = true;

            this.utils.Logger.info('Advanced video editor opened');

        } catch (error) {
            this.utils.Logger.error('Failed to open advanced editor:', error);
            
            // Show popup again on error
            if (this.popup) {
                this.popup.style.display = 'block';
            }
            
            alert('Failed to open advanced editor. Please try again.');
        }
    }

    /**
     * Close advanced editor and return to popup
     */
    closeAdvancedEditor() {
        if (this.videoEditor) {
            this.videoEditor.cleanup();
            this.videoEditor = null;
        }
        
        this.editorMode = false;
        
        // Show popup again
        if (this.popup) {
            this.popup.style.display = 'block';
        }
    }

    /**
     * Override close popup to handle editor mode
     */
    closePopup() {
        if (this.editorMode && this.videoEditor) {
            this.closeAdvancedEditor();
            return;
        }
        
        // Call parent method
        super.closePopup();
    }

    /**
     * Override cleanup to handle editor
     */
    cleanup() {
        if (this.videoEditor) {
            this.videoEditor.cleanup();
            this.videoEditor = null;
        }
        
        this.editorMode = false;
        
        // Call parent cleanup
        super.cleanup();
    }

    /**
     * Check if in editor mode
     * @returns {boolean}
     */
    isInEditorMode() {
        return this.editorMode;
    }

    /**
     * Get video editor instance
     * @returns {VideoEditor|null}
     */
    getVideoEditor() {
        return this.videoEditor;
    }
}

// Replace the existing PopupManager with enhanced version
if (typeof window !== 'undefined') {
    window.PopupManager = PopupManagerV2;
}