/**
 * Popup Manager Module
 * Handles creation and management of the custom clip editor popup
 */

class PopupManager {
    constructor() {
        this.popup = null;
        this.isDragging = false;
        this.dragOffset = { x: 0, y: 0 };
        this.currentVideo = null;
        
        // Get utilities and constants
        this.constants = window.TWITCH_CLIP_EDITOR_CONSTANTS;
        this.utils = window.TWITCH_CLIP_EDITOR_UTILS;
        
        // Bind methods to preserve context
        this.handleMouseDown = this.handleMouseDown.bind(this);
        this.handleMouseMove = this.handleMouseMove.bind(this);
        this.handleMouseUp = this.handleMouseUp.bind(this);
        this.handleTouchStart = this.handleTouchStart.bind(this);
        this.handleTouchMove = this.handleTouchMove.bind(this);
        this.handleTouchEnd = this.handleTouchEnd.bind(this);
    }

    /**
     * Create popup with video source
     * @param {string} videoSrc - Video source URL
     */
    createPopup(videoSrc) {
        this.removeExistingPopup();
        this.currentVideo = videoSrc;
        
        const popup = this.buildPopupElement(videoSrc);
        this.popup = popup;
        
        document.body.appendChild(popup);
        this.attachEventListeners();
        this.makeResponsive();
        
        // Add entrance animation
        popup.classList.add('entering');
        setTimeout(() => popup.classList.remove('entering'), 300);
    }

    /**
     * Create popup without video (fallback)
     */
    createFallbackPopup() {
        this.removeExistingPopup();
        
        const popup = this.buildFallbackPopupElement();
        this.popup = popup;
        
        document.body.appendChild(popup);
        this.attachEventListeners();
        this.makeResponsive();
        
        popup.classList.add('entering');
        setTimeout(() => popup.classList.remove('entering'), 300);
    }

    /**
     * Build popup element with video
     * @param {string} videoSrc - Video source URL
     * @returns {Element}
     */
    buildPopupElement(videoSrc) {
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
                    ></video>
                </div>
                <div class="clip-editor-controls">
                    <button class="clip-editor-button close" id="close-editor">
                        <span>✕</span> Close
                    </button>
                    <button class="clip-editor-button download" id="download-clip">
                        <span>⬇</span> Download
                    </button>
                </div>
            </div>
        `;

        return popup;
    }

    /**
     * Build fallback popup element
     * @returns {Element}
     */
    buildFallbackPopupElement() {
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
                <div class="clip-editor-error">
                    <h3>Extension Active!</h3>
                    <p>Could not automatically capture the video. Please try again after closing other popups, or save the video manually.</p>
                    <p><strong>Tip:</strong> Make sure you're on a live Twitch stream and click the clip button.</p>
                </div>
                <div class="clip-editor-controls">
                    <button class="clip-editor-button close" id="close-editor">
                        <span>✕</span> Close
                    </button>
                </div>
            </div>
        `;

        return popup;
    }

    /**
     * Remove existing popup
     */
    removeExistingPopup() {
        this.utils.DOMUtils.removeElement(this.constants.EXTENSION_CONFIG.POPUP_ID);
        this.popup = null;
        this.currentVideo = null;
    }

    /**
     * Attach event listeners to popup
     */
    attachEventListeners() {
        if (!this.popup) return;

        // Close button
        const closeButton = this.popup.querySelector('#close-editor');
        if (closeButton) {
            closeButton.addEventListener('click', () => this.closePopup());
        }

        // Download button
        const downloadButton = this.popup.querySelector('#download-clip');
        if (downloadButton) {
            downloadButton.addEventListener('click', () => this.downloadVideo());
        }

        // Drag functionality
        const dragHandle = this.popup.querySelector(`#${this.constants.EXTENSION_CONFIG.DRAG_HANDLE_ID}`);
        if (dragHandle) {
            this.attachDragListeners(dragHandle);
        }

        // Keyboard shortcuts
        this.attachKeyboardListeners();

        // Window resize
        window.addEventListener('resize', this.utils.EventUtils.debounce(() => {
            this.makeResponsive();
        }, 250));
    }

    /**
     * Attach drag event listeners
     * @param {Element} dragHandle - Drag handle element
     */
    attachDragListeners(dragHandle) {
        // Mouse events
        dragHandle.addEventListener('mousedown', this.handleMouseDown);
        document.addEventListener('mousemove', this.handleMouseMove);
        document.addEventListener('mouseup', this.handleMouseUp);

        // Touch events for mobile
        dragHandle.addEventListener('touchstart', this.handleTouchStart, { passive: false });
        document.addEventListener('touchmove', this.handleTouchMove, { passive: false });
        document.addEventListener('touchend', this.handleTouchEnd);
    }

    /**
     * Attach keyboard event listeners
     */
    attachKeyboardListeners() {
        document.addEventListener('keydown', (event) => {
            if (!this.popup) return;

            switch (event.key) {
                case 'Escape':
                    this.closePopup();
                    break;
                case 'd':
                case 'D':
                    if (event.ctrlKey || event.metaKey) {
                        event.preventDefault();
                        this.downloadVideo();
                    }
                    break;
            }
        });
    }

    /**
     * Handle mouse down event
     * @param {MouseEvent} event - Mouse event
     */
    handleMouseDown(event) {
        event.preventDefault();
        this.startDragging(event.clientX, event.clientY);
    }

    /**
     * Handle mouse move event
     * @param {MouseEvent} event - Mouse event
     */
    handleMouseMove(event) {
        if (!this.isDragging) return;
        event.preventDefault();
        this.updatePosition(event.clientX, event.clientY);
    }

    /**
     * Handle mouse up event
     */
    handleMouseUp() {
        this.stopDragging();
    }

    /**
     * Handle touch start event
     * @param {TouchEvent} event - Touch event
     */
    handleTouchStart(event) {
        event.preventDefault();
        const touch = event.touches[0];
        this.startDragging(touch.clientX, touch.clientY);
    }

    /**
     * Handle touch move event
     * @param {TouchEvent} event - Touch event
     */
    handleTouchMove(event) {
        if (!this.isDragging) return;
        event.preventDefault();
        const touch = event.touches[0];
        this.updatePosition(touch.clientX, touch.clientY);
    }

    /**
     * Handle touch end event
     */
    handleTouchEnd() {
        this.stopDragging();
    }

    /**
     * Start dragging
     * @param {number} clientX - X coordinate
     * @param {number} clientY - Y coordinate
     */
    startDragging(clientX, clientY) {
        if (!this.popup) return;

        this.isDragging = true;
        this.popup.classList.add(this.constants.CSS_CLASSES.DRAGGING);

        const rect = this.popup.getBoundingClientRect();
        this.dragOffset.x = clientX - rect.left;
        this.dragOffset.y = clientY - rect.top;
    }

    /**
     * Update popup position during drag
     * @param {number} clientX - X coordinate
     * @param {number} clientY - Y coordinate
     */
    updatePosition(clientX, clientY) {
        if (!this.popup || !this.isDragging) return;

        const newX = clientX - this.dragOffset.x;
        const newY = clientY - this.dragOffset.y;

        // Constrain to viewport
        const maxX = window.innerWidth - this.popup.offsetWidth;
        const maxY = window.innerHeight - this.popup.offsetHeight;

        const constrainedX = Math.max(0, Math.min(newX, maxX));
        const constrainedY = Math.max(0, Math.min(newY, maxY));

        this.utils.DOMUtils.applyStyles(this.popup, {
            left: `${constrainedX}px`,
            top: `${constrainedY}px`,
            transform: 'none'
        });
    }

    /**
     * Stop dragging
     */
    stopDragging() {
        if (!this.popup) return;

        this.isDragging = false;
        this.popup.classList.remove(this.constants.CSS_CLASSES.DRAGGING);
    }

    /**
     * Make popup responsive
     */
    makeResponsive() {
        if (!this.popup) return;

        const isMobile = window.innerWidth <= 480;
        const isTablet = window.innerWidth <= 768 && window.innerWidth > 480;

        if (isMobile || isTablet) {
            this.utils.DOMUtils.applyStyles(this.popup, {
                position: 'fixed',
                top: isMobile ? '2%' : '5%',
                left: isMobile ? '2%' : '5%',
                right: isMobile ? '2%' : '5%',
                transform: 'none',
                maxWidth: 'none',
                width: 'auto'
            });
        } else {
            // Reset to centered position for desktop
            this.utils.DOMUtils.applyStyles(this.popup, {
                top: '10%',
                left: '50%',
                right: 'auto',
                transform: 'translateX(-50%)',
                maxWidth: '90vw',
                width: 'auto'
            });
        }
    }

    /**
     * Close popup
     */
    closePopup() {
        if (this.popup) {
            this.popup.classList.add('exiting');
            setTimeout(() => {
                this.removeExistingPopup();
            }, 200);
        }
    }

    /**
     * Download current video
     */
    downloadVideo() {
        if (this.currentVideo && window.videoDownloader) {
            window.videoDownloader.downloadVideo(this.currentVideo);
        }
    }

    /**
     * Get current popup element
     * @returns {Element|null}
     */
    getPopup() {
        return this.popup;
    }

    /**
     * Check if popup is open
     * @returns {boolean}
     */
    isOpen() {
        return !!this.popup;
    }

    /**
     * Cleanup resources
     */
    cleanup() {
        this.removeExistingPopup();
        
        // Remove global event listeners
        document.removeEventListener('mousemove', this.handleMouseMove);
        document.removeEventListener('mouseup', this.handleMouseUp);
        document.removeEventListener('touchmove', this.handleTouchMove);
        document.removeEventListener('touchend', this.handleTouchEnd);
    }
}

// Export for use in main content script
if (typeof window !== 'undefined') {
    window.PopupManager = PopupManager;
}