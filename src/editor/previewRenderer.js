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
        this.startRendering();
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
     * Start rendering loop
     */
    startRendering() {
        if (this.isRendering) return;
        
        this.isRendering = true;
        this.renderLoop();
    }

    /**
     * Stop rendering loop
     */
    stopRendering() {
        this.isRendering = false;
        
        if (this.animationFrameId) {
            cancelAnimationFrame(this.animationFrameId);
            this.animationFrameId = null;
        }
    }

    /**
     * Main rendering loop
     */
    renderLoop() {
        if (!this.isRendering) return;
        
        this.renderFrame();
        this.animationFrameId = requestAnimationFrame(() => this.renderLoop());
    }

    /**
     * Render single frame
     */
    renderFrame() {
        if (!this.currentSelection || !this.sourceVideo) {
            this.clearCanvas();
            return;
        }
        
        // Get video dimensions
        const videoWidth = this.sourceVideo.videoWidth || this.sourceVideo.width;
        const videoHeight = this.sourceVideo.videoHeight || this.sourceVideo.height;
        
        if (videoWidth === 0 || videoHeight === 0) {
            this.clearCanvas();
            return;
        }
        
        // Calculate source area from selection
        const sourceArea = this.calculateSourceArea(videoWidth, videoHeight);
        
        // Render cropped area to preview
        this.renderCroppedArea(sourceArea, videoWidth, videoHeight);
    }

    /**
     * Calculate source area from current selection
     * @param {number} videoWidth - Source video width
     * @param {number} videoHeight - Source video height
     * @returns {Object} Source area coordinates
     */
    calculateSourceArea(videoWidth, videoHeight) {
        const selection = this.currentSelection;
        
        // Get scale factors (assuming landscape canvas shows full video)
        const canvasWidth = this.constants.CANVAS.MAX_WIDTH;
        const canvasHeight = this.constants.CANVAS.MAX_HEIGHT;
        
        // Calculate aspect ratios to determine how video fits in canvas
        const videoAspect = videoWidth / videoHeight;
        const canvasAspect = canvasWidth / canvasHeight;
        
        let scaleX, scaleY, offsetX = 0, offsetY = 0;
        
        if (videoAspect > canvasAspect) {
            // Video is wider - fit to canvas width
            scaleX = scaleY = videoWidth / canvasWidth;
            offsetY = (canvasHeight - videoHeight / scaleY) / 2;
        } else {
            // Video is taller - fit to canvas height
            scaleX = scaleY = videoHeight / canvasHeight;
            offsetX = (canvasWidth - videoWidth / scaleX) / 2;
        }
        
        // Convert selection coordinates to video coordinates
        const sourceX = Math.max(0, (selection.x - offsetX) * scaleX);
        const sourceY = Math.max(0, (selection.y - offsetY) * scaleY);
        const sourceWidth = Math.min(videoWidth - sourceX, selection.width * scaleX);
        const sourceHeight = Math.min(videoHeight - sourceY, selection.height * scaleY);
        
        return {
            x: sourceX,
            y: sourceY,
            width: Math.max(1, sourceWidth),
            height: Math.max(1, sourceHeight)
        };
    }

    /**
     * Render cropped area to preview canvas
     * @param {Object} sourceArea - Source area to crop
     * @param {number} videoWidth - Source video width
     * @param {number} videoHeight - Source video height
     */
    renderCroppedArea(sourceArea, videoWidth, videoHeight) {
        // Clear preview canvas
        this.previewCtx.clearRect(0, 0, this.previewCanvas.width, this.previewCanvas.height);
        
        // Set temp canvas size to match source area
        this.tempCanvas.width = sourceArea.width;
        this.tempCanvas.height = sourceArea.height;
        
        try {
            // Draw cropped area to temp canvas
            this.tempCtx.drawImage(
                this.sourceVideo,
                sourceArea.x, sourceArea.y, sourceArea.width, sourceArea.height,
                0, 0, sourceArea.width, sourceArea.height
            );
            
            // Calculate how to fit cropped area into 9:16 preview
            const previewAspect = 9 / 16;
            const sourceAspect = sourceArea.width / sourceArea.height;
            
            let drawWidth, drawHeight, drawX, drawY;
            
            if (sourceAspect > previewAspect) {
                // Source is wider - fit to preview height
                drawHeight = this.previewCanvas.height;
                drawWidth = drawHeight * sourceAspect;
                drawX = (this.previewCanvas.width - drawWidth) / 2;
                drawY = 0;
            } else {
                // Source is taller - fit to preview width
                drawWidth = this.previewCanvas.width;
                drawHeight = drawWidth / sourceAspect;
                drawX = 0;
                drawY = (this.previewCanvas.height - drawHeight) / 2;
            }
            
            // Draw to preview canvas with proper scaling
            this.previewCtx.drawImage(
                this.tempCanvas,
                0, 0, sourceArea.width, sourceArea.height,
                drawX, drawY, drawWidth, drawHeight
            );
            
            // Add frame border
            this.drawPreviewFrame();
            
        } catch (error) {
            this.utils.Logger.warn('Error rendering preview frame:', error);
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