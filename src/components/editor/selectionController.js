/**
 * Selection Controller Module
 * Handles draggable selection box with zoom and resize functionality
 */

class SelectionController {
    constructor(editor, canvasElement) {
        this.editor = editor;
        this.canvas = canvasElement;
        this.ctx = canvasElement.getContext('2d');
        
        // Selection state
        this.selection = {
            x: 0,
            y: 0,
            width: 0,
            height: 0,
            zoom: 1.0
        };
        
        // Interaction state
        this.isDragging = false;
        this.isResizing = false;
        this.dragStart = { x: 0, y: 0 };
        this.resizeHandle = null;
        
        // Get constants and utils
        this.constants = window.EDITOR_CONSTANTS;
        this.utils = window.TWITCH_CLIP_EDITOR_UTILS;
        
        this.initializeSelection();
        this.attachEventListeners();
    }

    /**
     * Initialize default selection position and size
     */
    initializeSelection() {
        const targetAspect = 9 / 16;
        const canvasHeight = this.canvas.height;
        const canvasWidth = this.canvas.width;

        let selHeight = canvasHeight;
        let selWidth = selHeight * targetAspect;

        if (selWidth > canvasWidth) {
            selWidth = canvasWidth;
            selHeight = selWidth / targetAspect;
        }
        
        this.selection = {
            x: (canvasWidth - selWidth) / 2,
            y: (canvasHeight - selHeight) / 2,
            width: selWidth,
            height: selHeight,
            zoom: 1.0
        };
        
        this.drawSelection();
        this.editor.onSelectionChanged(this.getSelectionData());
    }

    /**
     * Attach event listeners for interaction
     */
    attachEventListeners() {
        // Mouse events
        this.canvas.addEventListener('mousedown', this.handleMouseDown.bind(this));
        this.canvas.addEventListener('mousemove', this.handleMouseMove.bind(this));
        this.canvas.addEventListener('mouseup', this.handleMouseUp.bind(this));
        this.canvas.addEventListener('wheel', this.handleWheel.bind(this));
        
        // Touch events for mobile
        this.canvas.addEventListener('touchstart', this.handleTouchStart.bind(this));
        this.canvas.addEventListener('touchmove', this.handleTouchMove.bind(this));
        this.canvas.addEventListener('touchend', this.handleTouchEnd.bind(this));
        
        // Prevent context menu
        this.canvas.addEventListener('contextmenu', (e) => e.preventDefault());
    }

    /**
     * Handle mouse down event
     * @param {MouseEvent} event - Mouse event
     */
    handleMouseDown(event) {
        event.preventDefault();
        const rect = this.canvas.getBoundingClientRect();
        const x = event.clientX - rect.left;
        const y = event.clientY - rect.top;
        
        if (this.isInsideSelection(x, y)) {
            this.isDragging = true;
            this.dragStart = { 
                x: x - this.selection.x, 
                y: y - this.selection.y 
            };
        }
    }

    /**
     * Handle mouse move event
     */
    handleMouseMove(event) {
        const rect = this.canvas.getBoundingClientRect();
        const x = event.clientX - rect.left;
        const y = event.clientY - rect.top;
        
        if (this.isDragging) {
            this.selection.x = x - this.dragStart.x;
            this.selection.y = y - this.dragStart.y;
            
            this.constrainToCanvas();
            this.drawSelection();
            this.editor.onSelectionChanged(this.getSelectionData());
        } else {
            this.updateCursor(x, y);
        }
    }

    /**
     * Handle mouse up event
     */
    handleMouseUp() {
        this.isDragging = false;
    }

    /**
     * Handle wheel event for zooming
     */
    handleWheel(event) {
        event.preventDefault();
        
        const zoomDelta = event.deltaY > 0 ? -this.constants.SELECTION.ZOOM_SENSITIVITY : this.constants.SELECTION.ZOOM_SENSITIVITY;
        const newZoom = Math.max(
            this.constants.SELECTION.MIN_ZOOM,
            Math.min(this.constants.SELECTION.MAX_ZOOM, this.selection.zoom + zoomDelta)
        );
        
        if (newZoom !== this.selection.zoom) {
            this.applyZoom(newZoom);
            this.editor.onSelectionChanged(this.getSelectionData());
        }
    }

    /**
     * Handle touch start event
     */
    handleTouchStart(event) {
        event.preventDefault();
        const touch = event.touches[0];
        const mouseEvent = new MouseEvent('mousedown', {
            clientX: touch.clientX,
            clientY: touch.clientY
        });
        this.handleMouseDown(mouseEvent);
    }

    /**
     * Handle touch move event
     */
    handleTouchMove(event) {
        event.preventDefault();
        const touch = event.touches[0];
        const mouseEvent = new MouseEvent('mousemove', {
            clientX: touch.clientX,
            clientY: touch.clientY
        });
        this.handleMouseMove(mouseEvent);
    }

    /**
     * Handle touch end event
     */
    handleTouchEnd(event) {
        event.preventDefault();
        this.handleMouseUp();
    }

    /**
     * Apply zoom to selection
     */
    applyZoom(newZoom) {
        const targetAspect = 9 / 16;
        const centerX = this.selection.x + this.selection.width / 2;
        const centerY = this.selection.y + this.selection.height / 2;

        const zoomRatio = newZoom / this.selection.zoom;

        let newWidth = this.selection.width * zoomRatio;
        let newHeight = this.selection.height * zoomRatio;

        // Constrain to canvas max size while maintaining aspect ratio
        if (newWidth > this.canvas.width || newHeight > this.canvas.height) {
            if (this.canvas.width / targetAspect <= this.canvas.height) {
                newWidth = this.canvas.width;
                newHeight = newWidth / targetAspect;
            } else {
                newHeight = this.canvas.height;
                newWidth = newHeight * targetAspect;
            }
        }
        
        this.selection.width = newWidth;
        this.selection.height = newHeight;
        this.selection.x = centerX - this.selection.width / 2;
        this.selection.y = centerY - this.selection.height / 2;
        this.selection.zoom = newZoom;
        
        this.constrainToCanvas();
        this.drawSelection();
    }

    /**
     * Constrain selection to canvas bounds
     */
    constrainToCanvas() {
        this.selection.x = Math.max(0, Math.min(this.canvas.width - this.selection.width, this.selection.x));
        this.selection.y = Math.max(0, Math.min(this.canvas.height - this.selection.height, this.selection.y));
        this.selection.width = Math.min(this.selection.width, this.canvas.width - this.selection.x);
        this.selection.height = Math.min(this.selection.height, this.canvas.height - this.selection.y);
    }

    /**
     * Check if point is inside selection
     * @param {number} x - X coordinate
     * @param {number} y - Y coordinate
     * @returns {boolean}
     */
    isInsideSelection(x, y) {
        return x >= this.selection.x && 
               x <= this.selection.x + this.selection.width &&
               y >= this.selection.y && 
               y <= this.selection.y + this.selection.height;
    }

    /**
     * Get resize handle at position
     * @param {number} x - X coordinate
     * @param {number} y - Y coordinate
     * @returns {string|null}
     */
    updateCursor(x, y) {
        if (this.isInsideSelection(x, y)) {
            this.canvas.style.cursor = 'move';
        } else {
            this.canvas.style.cursor = 'default';
        }
    }

    /**
     * Draw selection rectangle and handles
     */
    drawSelection() {
        this.ctx.clearRect(0, 0, this.canvas.width, this.canvas.height);

        // Draw dark overlay over the entire canvas
        this.ctx.fillStyle = 'rgba(0, 0, 0, 0.6)';
        this.ctx.fillRect(0, 0, this.canvas.width, this.canvas.height);

        // Clear the selection area, making it transparent to the video underneath
        this.ctx.clearRect(this.selection.x, this.selection.y, this.selection.width, this.selection.height);

        // Draw a border around the clear area
        this.ctx.strokeStyle = this.constants.SELECTION.BORDER_COLOR;
        this.ctx.lineWidth = this.constants.SELECTION.BORDER_WIDTH;
        this.ctx.strokeRect(this.selection.x, this.selection.y, this.selection.width, this.selection.height);
    }

    /**
     * Draw zoom level indicator
     */
    drawZoomIndicator() {
        const text = `${Math.round(this.selection.zoom * 100)}%`;
        this.ctx.font = '14px Arial';
        this.ctx.fillStyle = this.constants.SELECTION.BORDER_COLOR;
        this.ctx.fillText(text, this.selection.x + 5, this.selection.y - 5);
    }

    /**
     * Get current selection data
     * @returns {Object}
     */
    getSelectionData() {
        return {
            x: this.selection.x,
            y: this.selection.y,
            width: this.selection.width,
            height: this.selection.height,
            zoom: this.selection.zoom,
            timestamp: Date.now()
        };
    }

    /**
     * Set selection programmatically
     * @param {Object} selectionData - Selection data
     */
    setSelection(selectionData) {
        this.selection = { ...selectionData };
        this.constrainToCanvas();
        this.drawSelection();
    }

    /**
     * Get selection bounds relative to video
     * @param {number} videoWidth - Original video width
     * @param {number} videoHeight - Original video height
     * @returns {Object}
     */
    getVideoSelectionBounds(videoWidth, videoHeight) {
        const scaleX = videoWidth / this.canvas.width;
        const scaleY = videoHeight / this.canvas.height;
        
        return {
            x: this.selection.x * scaleX,
            y: this.selection.y * scaleY,
            width: this.selection.width * scaleX,
            height: this.selection.height * scaleY,
            zoom: this.selection.zoom
        };
    }

    /**
     * Cleanup event listeners
     */
    cleanup() {
        // Remove event listeners
        this.canvas.removeEventListener('mousedown', this.handleMouseDown);
        this.canvas.removeEventListener('mousemove', this.handleMouseMove);
        this.canvas.removeEventListener('mouseup', this.handleMouseUp);
        this.canvas.removeEventListener('wheel', this.handleWheel);
        this.canvas.removeEventListener('touchstart', this.handleTouchStart);
        this.canvas.removeEventListener('touchmove', this.handleTouchMove);
        this.canvas.removeEventListener('touchend', this.handleTouchEnd);
    }
}

// Export for use in video editor
if (typeof window !== 'undefined') {
    window.SelectionController = SelectionController;
}