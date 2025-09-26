/**
 * Preview Renderer Module
 * Renders real-time 9:16 portrait preview of selected area
 */

class PreviewRenderer {
    constructor(editor, sourceVideo) {
        this.editor = editor;
        this.sourceVideo = sourceVideo;
        
        // Canvas elements
        this.previewCanvas = null;
        this.previewCtx = null;
        this.tempCanvas = null;
        this.tempCtx = null;
        
        // Rendering state
        this.isRendering = false;
        this.currentSelection = null;
        this.animationFrameId = null;
        
        // Get constants and utils
        this.constants = window.EDITOR_CONSTANTS;
        this.utils = window.TWITCH_CLIP_EDITOR_UTILS;
        
        this.initializeCanvas();
    }

    /**
     * Initialize preview canvas
     */
    initializeCanvas() {
        // Create preview canvas
        this.previewCanvas = document.createElement('canvas');
        this.previewCanvas.width = this.constants.CANVAS.PREVIEW_WIDTH;
        this.previewCanvas.height = this.constants.CANVAS.PREVIEW_HEIGHT;
        this.previewCanvas.className = 'portrait-preview-canvas';
        this.previewCtx = this.previewCanvas.getContext('2d');
        
        // Create temporary canvas for processing
        this.tempCanvas = document.createElement('canvas');
        this.tempCtx = this.tempCanvas.getContext('2d');
        
        // Set high quality rendering
        this.previewCtx.imageSmoothingEnabled = true;
        this.previewCtx.imageSmoothingQuality = 'high';
        this.tempCtx.imageSmoothingEnabled = true;
        this.tempCtx.imageSmoothingQuality = 'high';
    }

    /**
     * Get preview canvas element
     * @returns {HTMLCanvasElement}
     */
    getCanvas() {
        return this.previewCanvas;
    }

    /**
     * Render single frame
     */
    render() {
        if (!this.currentSelection || !this.sourceVideo || this.sourceVideo.videoWidth === 0) {
            this.clearCanvas();
            return;
        }

        const { videoWidth, videoHeight } = this.sourceVideo;
        const mainCanvas = this.editor.landscapeCanvas;

        // Calculate the scaling factor between the video and the canvas it's displayed on.
        // This accounts for letterboxing if the video's aspect ratio is different from the canvas's.
        const scale = Math.min(mainCanvas.width / videoWidth, mainCanvas.height / videoHeight);
        
        // Calculate the rendered video's dimensions and position on the main canvas
        const renderedVideoWidth = videoWidth * scale;
        const renderedVideoHeight = videoHeight * scale;
        const offsetX = (mainCanvas.width - renderedVideoWidth) / 2;
        const offsetY = (mainCanvas.height - renderedVideoHeight) / 2;

        // Translate the selection coordinates (which are relative to the canvas)
        // to be relative to the video itself.
        const sourceX = (this.currentSelection.x - offsetX) / scale;
        const sourceY = (this.currentSelection.y - offsetY) / scale;
        const sourceWidth = this.currentSelection.width / scale;
        const sourceHeight = this.currentSelection.height / scale;

        // Clear the preview canvas and draw the calculated source area from the video
        this.previewCtx.clearRect(0, 0, this.previewCanvas.width, this.previewCanvas.height);
        try {
            this.previewCtx.drawImage(
                this.sourceVideo,
                sourceX,
                sourceY,
                sourceWidth,
                sourceHeight,
                0, // Draw at the top-left corner of the preview canvas
                0,
                this.previewCanvas.width, // Stretch to fill the preview canvas
                this.previewCanvas.height
            );
        } catch (e) {
            this.utils.Logger.warn('Error drawing preview frame:', e);
            this.drawErrorState();
        }
    }

    /**
     * Draw frame border around preview
     */
    drawPreviewFrame() {
        this.previewCtx.strokeStyle = '#333333';
        this.previewCtx.lineWidth = 2;
        this.previewCtx.strokeRect(1, 1, this.previewCanvas.width - 2, this.previewCanvas.height - 2);
    }

    /**
     * Draw error state
     */
    drawErrorState() {
        this.clearCanvas();
        
        this.previewCtx.fillStyle = '#333333';
        this.previewCtx.fillRect(0, 0, this.previewCanvas.width, this.previewCanvas.height);
        
        this.previewCtx.fillStyle = '#666666';
        this.previewCtx.font = '14px Arial';
        this.previewCtx.textAlign = 'center';
        this.previewCtx.fillText(
            'Preview Error',
            this.previewCanvas.width / 2,
            this.previewCanvas.height / 2
        );
    }

    /**
     * Clear canvas
     */
    clearCanvas() {
        this.previewCtx.clearRect(0, 0, this.previewCanvas.width, this.previewCanvas.height);
        
        // Draw placeholder
        this.previewCtx.fillStyle = '#1a1a1a';
        this.previewCtx.fillRect(0, 0, this.previewCanvas.width, this.previewCanvas.height);
        
        this.previewCtx.fillStyle = '#666666';
        this.previewCtx.font = '16px Arial';
        this.previewCtx.textAlign = 'center';
        this.previewCtx.fillText(
            '9:16 Preview',
            this.previewCanvas.width / 2,
            this.previewCanvas.height / 2 - 10
        );
        
        this.previewCtx.font = '12px Arial';
        this.previewCtx.fillText(
            'Select area to preview',
            this.previewCanvas.width / 2,
            this.previewCanvas.height / 2 + 10
        );
    }

    /**
     * Update selection for rendering
     * @param {Object} selectionData - Current selection data
     */
    updateSelection(selectionData) {
        this.currentSelection = selectionData;
    }

    /**
     * Capture current preview frame as image data
     * @returns {ImageData} Preview frame data
     */
    captureFrame() {
        return this.previewCtx.getImageData(0, 0, this.previewCanvas.width, this.previewCanvas.height);
    }

    /**
     * Export preview as blob
     * @param {string} format - Export format (default: 'image/png')
     * @param {number} quality - Export quality (default: 1.0)
     * @returns {Promise<Blob>} Preview blob
     */
    async exportPreview(format = 'image/png', quality = 1.0) {
        return new Promise((resolve) => {
            this.previewCanvas.toBlob(resolve, format, quality);
        });
    }

    /**
     * Render frame at specific timestamp with selection
     * @param {number} timestamp - Video timestamp
     * @param {Object} selectionData - Selection data for this frame
     * @returns {Promise<ImageData>} Rendered frame data
     */
    async renderFrameAtTime(timestamp, selectionData) {
        // Store current state
        const previousSelection = this.currentSelection;
        
        // Set temporary selection
        this.updateSelection(selectionData);
        
        // Seek video to timestamp (if possible)
        if (this.sourceVideo.currentTime !== timestamp) {
            this.sourceVideo.currentTime = timestamp;
            
            // Wait for seek to complete
            await new Promise(resolve => {
                const onSeeked = () => {
                    this.sourceVideo.removeEventListener('seeked', onSeeked);
                    resolve();
                };
                this.sourceVideo.addEventListener('seeked', onSeeked);
            });
        }
        
        // Render frame
        this.renderFrame();
        
        // Capture frame data
        const frameData = this.captureFrame();
        
        // Restore previous selection
        this.currentSelection = previousSelection;
        
        return frameData;
    }

    /**
     * Get preview canvas dimensions
     * @returns {Object} Canvas dimensions
     */
    getDimensions() {
        return {
            width: this.previewCanvas.width,
            height: this.previewCanvas.height,
            aspectRatio: this.previewCanvas.width / this.previewCanvas.height
        };
    }

    /**
     * Resize preview canvas
     * @param {number} width - New width
     * @param {number} height - New height
     */
    resize(width, height) {
        this.previewCanvas.width = width;
        this.previewCanvas.height = height;
        
        // Maintain quality settings
        this.previewCtx.imageSmoothingEnabled = true;
        this.previewCtx.imageSmoothingQuality = 'high';
    }

    /**
     * Set rendering quality
     * @param {string} quality - Quality level ('low', 'medium', 'high')
     */
    setQuality(quality) {
        const qualityMap = {
            'low': false,
            'medium': true,
            'high': true
        };
        
        const smoothingQualityMap = {
            'low': 'low',
            'medium': 'medium', 
            'high': 'high'
        };
        
        this.previewCtx.imageSmoothingEnabled = qualityMap[quality];
        this.previewCtx.imageSmoothingQuality = smoothingQualityMap[quality];
        this.tempCtx.imageSmoothingEnabled = qualityMap[quality];
        this.tempCtx.imageSmoothingQuality = smoothingQualityMap[quality];
    }

    /**
     * Cleanup resources
     */
    cleanup() {
        this.stopRendering();
        
        // Clear canvases
        if (this.previewCanvas) {
            this.previewCtx.clearRect(0, 0, this.previewCanvas.width, this.previewCanvas.height);
        }
        
        if (this.tempCanvas) {
            this.tempCtx.clearRect(0, 0, this.tempCanvas.width, this.tempCanvas.height);
        }
        
        this.currentSelection = null;
    }
}

// Export for use in video editor
if (typeof window !== 'undefined') {
    window.PreviewRenderer = PreviewRenderer;
}