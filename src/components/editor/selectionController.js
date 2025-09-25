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
        const canvasRect = this.canvas.getBoundingClientRect();
        const defaultWidth = canvasRect.width * this.constants.SELECTION.DEFAULT_WIDTH_PERCENT;
        const defaultHeight = canvasRect.height * this.constants.SELECTION.DEFAULT_HEIGHT_PERCENT;
        
        this.selection = {
            x: (canvasRect.width - defaultWidth) / 2,
            y: (canvasRect.height - defaultHeight) / 2,
            width: defaultWidth,
            height: defaultHeight,
            zoom: 1.0
        };
        
        this.drawSelection();
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
        
        // Check if clicking on resize handle
        const handle = this.getResizeHandle(x, y);
        if (handle) {
            this.isResizing = true;
            this.resizeHandle = handle;
            return;
        }
        
        // Check if clicking inside selection for dragging
        if (this.isInsideSelection(x, y)) {
            this.isDragging = true;
            this.dragStart = { x, y };
        }
    }

    /**
     * Handle mouse move event
     * @param {MouseEvent} event - Mouse event
     */
    handleMouseMove(event) {
        const rect = this.canvas.getBoundingClientRect();
        const x = event.clientX - rect.left;
        const y = event.clientY - rect.top;
        
        if (this.isDragging) {
            this.handleDrag(x, y);
        } else if (this.isResizing) {
            this.handleResize(x, y);
        } else {
            this.updateCursor(x, y);
        }
    }

    /**
     * Handle mouse up event
     */
    handleMouseUp() {
        if (this.isDragging || this.isResizing) {
            this.isDragging = false;
            this.isResizing = false;
            this.resizeHandle = null;
            
            // Notify editor of selection change
            this.editor.onSelectionChanged(this.getSelectionData());
        }
    }

    /**
     * Handle wheel event for zooming
     * @param {WheelEvent} event - Wheel event
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
     * @param {TouchEvent} event - Touch event
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
     * @param {TouchEvent} event - Touch event
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
     * Handle dragging of selection
     * @param {number} x - Current x position
     * @param {number} y - Current y position
     */
    handleDrag(x, y) {
        const deltaX = x - this.dragStart.x;
        const deltaY = y - this.dragStart.y;
        
        const newX = Math.max(0, Math.min(this.canvas.width - this.selection.width, this.selection.x + deltaX));
        const newY = Math.max(0, Math.min(this.canvas.height - this.selection.height, this.selection.y + deltaY));
        
        this.selection.x = newX;
        this.selection.y = newY;
        this.dragStart = { x, y };
        
        this.drawSelection();
    }

    /**
     * Handle resizing of selection
     * @param {number} x - Current x position
     * @param {number} y - Current y position
     */
    handleResize(x, y) {
        const minSize = this.constants.SELECTION.MIN_WIDTH;
        
        switch (this.resizeHandle) {
            case 'se': // Southeast corner
                this.selection.width = Math.max(minSize, x - this.selection.x);
                this.selection.height = Math.max(minSize, y - this.selection.y);
                break;
            case 'sw': // Southwest corner
                const newWidth = this.selection.x + this.selection.width - x;
                if (newWidth >= minSize) {
                    this.selection.width = newWidth;
                    this.selection.x = x;
                }
                this.selection.height = Math.max(minSize, y - this.selection.y);
                break;
            case 'ne': // Northeast corner
                this.selection.width = Math.max(minSize, x - this.selection.x);
                const newHeight = this.selection.y + this.selection.height - y;
                if (newHeight >= minSize) {
                    this.selection.height = newHeight;
                    this.selection.y = y;
                }
                break;
            case 'nw': // Northwest corner
                const newWidthNW = this.selection.x + this.selection.width - x;
                const newHeightNW = this.selection.y + this.selection.height - y;
                if (newWidthNW >= minSize) {
                    this.selection.width = newWidthNW;
                    this.selection.x = x;
                }
                if (newHeightNW >= minSize) {
                    this.selection.height = newHeightNW;
                    this.selection.y = y;
                }
                break;
        }
        
        // Constrain to canvas bounds
        this.constrainToCanvas();
        this.drawSelection();
    }

    /**
     * Apply zoom to selection
     * @param {number} newZoom - New zoom level
     */
    applyZoom(newZoom) {
        const zoomRatio = newZoom / this.selection.zoom;
        const centerX = this.selection.x + this.selection.width / 2;
        const centerY = this.selection.y + this.selection.height / 2;
        
        this.selection.width *= zoomRatio;
        this.selection.height *= zoomRatio;
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
    getResizeHandle(x, y) {
        const handleSize = this.constants.SELECTION.HANDLE_SIZE;
        const sel = this.selection;
        
        // Check each corner
        const handles = {
            'nw': { x: sel.x, y: sel.y },
            'ne': { x: sel.x + sel.width, y: sel.y },
            'sw': { x: sel.x, y: sel.y + sel.height },
            'se': { x: sel.x + sel.width, y: sel.y + sel.height }
        };
        
        for (const [handle, pos] of Object.entries(handles)) {
            if (Math.abs(x - pos.x) <= handleSize && Math.abs(y - pos.y) <= handleSize) {
                return handle;
            }
        }
        
        return null;
    }

    /**
     * Update cursor based on position
     * @param {number} x - X coordinate
     * @param {number} y - Y coordinate
     */
    updateCursor(x, y) {
        const handle = this.getResizeHandle(x, y);
        
        if (handle) {
            const cursors = {
                'nw': 'nw-resize',
                'ne': 'ne-resize',
                'sw': 'sw-resize',
                'se': 'se-resize'
            };
            this.canvas.style.cursor = cursors[handle];
        } else if (this.isInsideSelection(x, y)) {
            this.canvas.style.cursor = 'move';
        } else {
            this.canvas.style.cursor = 'default';
        }
    }

    /**
     * Draw selection rectangle and handles
     */
    drawSelection() {
        // Clear previous selection
        this.ctx.clearRect(0, 0, this.canvas.width, this.canvas.height);
        
        // Draw selection rectangle
        this.ctx.strokeStyle = this.constants.SELECTION.BORDER_COLOR;
        this.ctx.lineWidth = this.constants.SELECTION.BORDER_WIDTH;
        this.ctx.strokeRect(this.selection.x, this.selection.y, this.selection.width, this.selection.height);
        
        // Draw handles
        this.drawHandles();
        
        // Draw zoom indicator
        this.drawZoomIndicator();
    }

    /**
     * Draw resize handles
     */
    drawHandles() {
        const handleSize = this.constants.SELECTION.HANDLE_SIZE;
        const sel = this.selection;
        
        this.ctx.fillStyle = this.constants.SELECTION.BORDER_COLOR;
        
        const handles = [
            { x: sel.x, y: sel.y }, // NW
            { x: sel.x + sel.width, y: sel.y }, // NE
            { x: sel.x, y: sel.y + sel.height }, // SW
            { x: sel.x + sel.width, y: sel.y + sel.height } // SE
        ];
        
        handles.forEach(handle => {
            this.ctx.fillRect(
                handle.x - handleSize / 2,
                handle.y - handleSize / 2,
                handleSize,
                handleSize
            );
        });
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