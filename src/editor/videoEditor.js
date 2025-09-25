/**
 * Video Editor Main Module - FIXED VERSION
 * Orchestrates the advanced video editing interface with real-time crop and preview
 */

class VideoEditor {
    constructor(videoElement, videoSrc) {
        // Core components
        this.sourceVideo = videoElement;
        this.videoSrc = videoSrc;
        
        // Canvas elements
        this.landscapeCanvas = null;
        this.landscapeCtx = null;
        
        // Module instances
        this.selectionController = null;
        this.frameRecorder = null;
        this.previewRenderer = null;
        
        // Editor state
        this.isInitialized = false;
        this.currentMode = 'preview'; // preview, record, edit, export
        this.isPlaying = false;
        this.currentTime = 0;
        this.duration = 0;
        
        // UI elements
        this.container = null;
        this.controls = null;
        this.timeline = null;
        
        // Get constants and utils
        this.constants = window.EDITOR_CONSTANTS;
        this.utils = window.TWITCH_CLIP_EDITOR_UTILS;
        this.cssClasses = window.EDITOR_CSS_CLASSES;
        
        // Event handlers (bound methods)
        this.handleVideoTimeUpdate = this.handleVideoTimeUpdate.bind(this);
        this.handleVideoLoadedMetadata = this.handleVideoLoadedMetadata.bind(this);
        this.handleSelectionChange = this.handleSelectionChange.bind(this);
        this.handlePlayPause = this.handlePlayPause.bind(this);
        this.handleRecord = this.handleRecord.bind(this);
        this.handleStop = this.handleStop.bind(this);
        this.handleExport = this.handleExport.bind(this);
    }

    /**
     * Initialize the video editor
     * @returns {Promise<void>}
     */
    async initialize() {
        if (this.isInitialized) return;

        try {
            this.utils.Logger.info('Initializing Video Editor...');

            await this.setupVideo();
            this.createInterface();
            this.initializeModules();
            this.attachEventListeners();

            this.isInitialized = true;
            this.utils.Logger.info(this.constants.EDITOR_MESSAGES?.EDITOR_INITIALIZED || 'Video Editor initialized');

        } catch (error) {
            this.utils.Logger.error('Failed to initialize Video Editor:', error);
            this.showCapabilityWarning(); // Inform user of limited functionality
            this.createInterface(); // Proceed with interface even if video fails
            this.initializeModules();
            this.attachEventListeners();
            this.isInitialized = true; // Mark as initialized with limitations
        }
    }

    /**
     * Setup video element - USING DOWNLOADS API
     * @returns {Promise<void>}
     */
    async setupVideo() {
        try {
            this.utils.Logger.info('🎬 Setting up video with background Chrome API...');

            this.showDownloadProgress('Initializing video download...');

            window.videoProcessor.setProgressCallback((percent) => {
                this.updateDownloadProgress(`Downloading... ${percent}%`, percent);
            });

            const processedVideo = await window.videoProcessor.downloadAndProcess(this.videoSrc);

            // Workaround: Since file:// URL won't work, we need to read the file
            // This is a limitation; see note below
            const filePath = processedVideo.localUrl.replace('file://', '');
            // Placeholder: Reading file as blob requires FileSystem API or proxy
            // For now, fall back to direct URL (which may fail due to CORS)
            this.sourceVideo.src = this.videoSrc; // Temporary fallback
            this.sourceVideo.type = 'video/mp4';
            this.sourceVideo.preload = 'metadata';
            this.videoBlob = null; // Update when blob is available

            this.utils.Logger.info('✅ Video configured (temporary fallback):', {
                method: processedVideo.downloadMethod,
                canManipulate: processedVideo.canManipulate,
                url: this.videoSrc.substring(0, 50) + '...'
            });

            this.updateDownloadProgress('Loading video...', 95);

            return new Promise((resolve, reject) => {
                let resolved = false;

                const onLoadedMetadata = () => {
                    if (resolved) return;
                    resolved = true;
                    this.sourceVideo.removeEventListener('loadedmetadata', onLoadedMetadata);
                    this.sourceVideo.removeEventListener('error', onError);
                    this.duration = this.sourceVideo.duration;
                    this.hideDownloadProgress();
                    this.utils.Logger.info('✅ Video loaded! Duration:', this.duration);
                    resolve();
                };

                const onError = (event) => {
                    if (resolved) return;
                    resolved = true;
                    this.sourceVideo.removeEventListener('loadedmetadata', onLoadedMetadata);
                    this.sourceVideo.removeEventListener('error', onError);
                    this.hideDownloadProgress();
                    this.utils.Logger.error('❌ Video load error:', event);
                    this.showCapabilityWarning(); // Notify user of limited mode
                    resolve(); // Continue with limited functionality
                };

                this.sourceVideo.addEventListener('loadedmetadata', onLoadedMetadata);
                this.sourceVideo.addEventListener('error', onError);

                setTimeout(() => {
                    if (!resolved) {
                        resolved = true;
                        this.hideDownloadProgress();
                        this.utils.Logger.warn('⏱️ Video load timeout');
                        this.showCapabilityWarning();
                        resolve();
                    }
                }, 30000);
            });

        } catch (error) {
            this.hideDownloadProgress();
            this.utils.Logger.error('❌ Enhanced setup failed:', error);
            this.showCapabilityWarning();
            throw error;
        }
    }

    /**
     * Show capability warning for direct video
     */
    showCapabilityWarning() {
        const warning = document.createElement('div');
        warning.style.cssText = `
            position: fixed; top: 20px; right: 20px; 
            background: rgba(255, 193, 7, 0.9); color: #000;
            padding: 12px 16px; border-radius: 8px; z-index: 9999999;
            font-size: 14px; font-weight: 500; max-width: 300px;
        `;
        warning.innerHTML = `
            ⚠️ Limited Mode: Video manipulation restricted due to CORS policies. 
            Interface fully functional for testing.
        `;
        document.body.appendChild(warning);
        
        setTimeout(() => warning.remove(), 5000);
    }

    /**
     * Show download progress
     * @param {string} message - Progress message
     */
    showDownloadProgress(message) {
        // Remove existing progress if any
        this.hideDownloadProgress();
        
        // Create progress indicator
        const progressDiv = document.createElement('div');
        progressDiv.id = 'video-download-progress';
        progressDiv.style.cssText = `
            position: fixed;
            top: 50%;
            left: 50%;
            transform: translate(-50%, -50%);
            background: rgba(0, 0, 0, 0.9);
            color: white;
            padding: 30px 40px;
            border-radius: 12px;
            z-index: 9999999;
            font-family: 'Segoe UI', Arial, sans-serif;
            text-align: center;
            box-shadow: 0 8px 32px rgba(0, 0, 0, 0.5);
            backdrop-filter: blur(10px);
            border: 1px solid rgba(255, 255, 255, 0.1);
        `;
        
        progressDiv.innerHTML = `
            <div style="font-size: 18px; margin-bottom: 15px;">
                📥 ${message}
            </div>
            <div style="width: 200px; height: 4px; background: #333; border-radius: 2px; overflow: hidden;">
                <div class="progress-bar" style="
                    width: 0%; 
                    height: 100%; 
                    background: linear-gradient(90deg, #00D4FF, #0099CC);
                    border-radius: 2px;
                    animation: progressPulse 2s ease-in-out infinite;
                "></div>
            </div>
            <div style="margin-top: 12px; font-size: 14px; color: #ccc;">
                Please wait...
            </div>
            <style>
                @keyframes progressPulse {
                    0%, 100% { width: 0%; }
                    50% { width: 100%; }
                }
            </style>
        `;
        
        document.body.appendChild(progressDiv);
        
        this.utils?.Logger.info('📱 Showing download progress:', message);
    }

    /**
     * Hide download progress
     */
    hideDownloadProgress() {
        const progressDiv = document.getElementById('video-download-progress');
        if (progressDiv) {
            progressDiv.remove();
            this.utils?.Logger.info('📱 Download progress hidden');
        }
    }

    /**
     * Update download progress
     * @param {string} message - New message
     * @param {number} percent - Progress percentage (0-100)
     */
    updateDownloadProgress(message, percent = null) {
        const progressDiv = document.getElementById('video-download-progress');
        if (!progressDiv) return;
        
        const messageEl = progressDiv.querySelector('div');
        if (messageEl) {
            messageEl.textContent = `📥 ${message}`;
        }
        
        if (percent !== null) {
            const progressBar = progressDiv.querySelector('.progress-bar');
            if (progressBar) {
                progressBar.style.width = `${Math.min(100, Math.max(0, percent))}%`;
                progressBar.style.animation = 'none'; // Stop pulse animation
            }
        }
    }

    /**
     * Handle video load error with fallback
     */
    async handleVideoLoadError(error, resolve, reject) {
        try {
            this.utils.Logger.warn('⚠️ Trying alternative approach...');
            
            // ✅ ALTERNATIVA: Usar Chrome Downloads para baixar
            await this.downloadWithChromeAPI();
            resolve(); // Continua mesmo se não conseguir baixar
            
        } catch (downloadError) {
            this.utils.Logger.error('❌ All methods failed:', downloadError);
            
            // ✅ ÚLTIMO FALLBACK: Continuar sem download
            this.utils.Logger.warn('⚠️ Continuing without video manipulation...');
            resolve(); // Deixa continuar para mostrar a interface
        }
    }

    /**
     * Download using Chrome Downloads API
     */
    async downloadWithChromeAPI() {
        try {
            if (!chrome.downloads) {
                throw new Error('Chrome Downloads API not available');
            }
            
            const filename = `twitch-clip-${Date.now()}.mp4`;
            
            const downloadId = await chrome.downloads.download({
                url: this.videoSrc,
                filename: filename,
                conflictAction: 'overwrite'
            });
            
            this.utils.Logger.info('✅ Download started with Chrome API:', downloadId);
            
            // Não esperar o download terminar - continua com a interface
            return true;
            
        } catch (error) {
            this.utils.Logger.error('❌ Chrome Downloads failed:', error);
            throw error;
        }
    }

    /**
     * Create the main interface
     */
    createInterface() {
        // Create main container
        this.container = this.utils.DOMUtils.createElement('div', {
            className: this.cssClasses.EDITOR_CONTAINER,
            innerHTML: this.generateInterfaceHTML()
        });
        
        // Get references to UI elements
        this.setupUIReferences();
        
        // Setup canvas
        this.setupCanvas();
    }

    /**
     * Generate interface HTML - FIXED VERSION
     * @returns {string} Interface HTML
     */
    generateInterfaceHTML() {
        return `
            <div class="editor-header">
                <h3>🎬 Advanced Clip Editor</h3>
                <div class="editor-header-controls">
                    <button class="upload-video-btn" id="upload-video-btn" title="Upload Video File">
                        <span class="icon">📁</span>
                        <span class="text">Upload Video</span>
                    </button>
                    <div class="editor-mode-indicator">
                        <span class="mode-text">Preview Mode</span>
                        <div class="recording-indicator hidden">🔴 REC</div>
                    </div>
                </div>
            </div>

            <!-- Hidden file input -->
            <input type="file" 
                id="video-file-input" 
                accept="video/mp4,video/webm,video/ogg,video/*" 
                style="display: none;">
            
            <div class="editor-main">
                <div class="editor-left-panel">
                    <div class="landscape-video-container drop-zone" id="drop-zone">
                        <canvas class="${this.cssClasses.LANDSCAPE_CANVAS}" 
                                width="${this.constants.CANVAS.MAX_WIDTH}" 
                                height="${this.constants.CANVAS.MAX_HEIGHT}">
                        </canvas>
                        <div class="video-overlay">
                            <div class="selection-info">
                                <span class="coordinates">X: 0, Y: 0</span>
                                <span class="dimensions">W: 0, H: 0</span>
                                <span class="zoom-level">Zoom: 100%</span>
                            </div>
                        </div>
                        
                        <!-- Drop overlay -->
                        <div class="drop-overlay" id="drop-overlay">
                            <div class="drop-content">
                                <div class="drop-icon">📁</div>
                                <div class="drop-text">Drop video file here</div>
                                <div class="drop-formats">MP4, WebM, MOV supported</div>
                            </div>
                        </div>
                    </div>
                    
                    <div class="editor-timeline-container">
                        <div class="${this.cssClasses.TIMELINE}">
                            <div class="timeline-track">
                                <div class="timeline-progress"></div>
                                <div class="timeline-scrubber"></div>
                                <div class="keyframes-container"></div>
                            </div>
                            <div class="timeline-time">
                                <span class="current-time">00:00</span>
                                <span class="duration">/ 00:00</span>
                            </div>
                        </div>
                    </div>
                </div>
                
                <div class="editor-right-panel">
                    <div class="preview-container">
                        <h4>Portrait Preview (9:16)</h4>
                        <div class="preview-canvas-container">
                            <!-- Preview canvas will be inserted here -->
                        </div>
                        <div class="preview-info">
                            <div class="export-resolution">1080 x 1920</div>
                            <div class="preview-fps">30 FPS</div>
                        </div>
                    </div>
                    
                    <div class="editor-controls-panel">
                        <div class="playback-controls">
                            <button class="control-btn play-pause-btn" title="Play/Pause">
                                <span class="icon">▶️</span>
                            </button>
                            <button class="control-btn stop-btn" title="Stop">
                                <span class="icon">⏹️</span>
                            </button>
                            <button class="control-btn restart-btn" title="Restart">
                                <span class="icon">⏮️</span>
                            </button>
                        </div>
                        
                        <div class="recording-controls">
                            <button class="control-btn record-btn" title="Start/Stop Recording">
                                <span class="icon">⏺️</span>
                                <span class="text">Record Motion</span>
                            </button>
                        </div>
                        
                        <div class="export-controls">
                            <button class="control-btn export-btn" title="Export Video">
                                <span class="icon">📥</span>
                                <span class="text">Export 9:16</span>
                            </button>
                            <button class="control-btn download-original-btn" title="Download Original">
                                <span class="icon">💾</span>
                                <span class="text">Download Original</span>
                            </button>
                        </div>
                        
                        <div class="editor-stats">
                            <div class="stat-item">
                                <span class="label">Keyframes:</span>
                                <span class="value keyframes-count">0</span>
                            </div>
                            <div class="stat-item">
                                <span class="label">Duration:</span>
                                <span class="value recording-duration">00:00</span>
                            </div>
                        </div>
                    </div>
                </div>
            </div>
            
            <div class="editor-instructions">
                <div class="instruction-item">
                    <strong>🖱️ Drag:</strong> Move selection area
                </div>
                <div class="instruction-item">
                    <strong>🔍 Scroll:</strong> Zoom in/out
                </div>
                <div class="instruction-item">
                    <strong>⏺️ Record:</strong> Capture motion while playing
                </div>
                <div class="instruction-item">
                    <strong>📱 Preview:</strong> Real-time 9:16 result
                </div>
            </div>
        `;
    }

    /**
     * Setup UI element references - FIXED
     */
    setupUIReferences() {
        // Get canvas
        this.landscapeCanvas = this.container.querySelector(`.${this.cssClasses.LANDSCAPE_CANVAS}`);
        if (!this.landscapeCanvas) {
            // Fallback selector
            this.landscapeCanvas = this.container.querySelector('canvas');
        }
        this.landscapeCtx = this.landscapeCanvas?.getContext('2d');
        
        // Get control elements
        this.controls = {
            playPause: this.container.querySelector('.play-pause-btn'),
            stop: this.container.querySelector('.stop-btn'),
            restart: this.container.querySelector('.restart-btn'),
            record: this.container.querySelector('.record-btn'),
            export: this.container.querySelector('.export-btn'),
            downloadOriginal: this.container.querySelector('.download-original-btn')
        };
        
        // Get info elements
        this.infoElements = {
            coordinates: this.container.querySelector('.coordinates'),
            dimensions: this.container.querySelector('.dimensions'),
            zoomLevel: this.container.querySelector('.zoom-level'),
            currentTime: this.container.querySelector('.current-time'),
            duration: this.container.querySelector('.duration'),
            keyframesCount: this.container.querySelector('.keyframes-count'),
            recordingDuration: this.container.querySelector('.recording-duration'),
            modeText: this.container.querySelector('.mode-text'),
            recordingIndicator: this.container.querySelector('.recording-indicator')
        };
        
        // Get timeline elements
        this.timeline = {
            container: this.container.querySelector(`.${this.cssClasses.TIMELINE}`),
            track: this.container.querySelector('.timeline-track'),
            progress: this.container.querySelector('.timeline-progress'),
            scrubber: this.container.querySelector('.timeline-scrubber'),
            keyframesContainer: this.container.querySelector('.keyframes-container')
        };
        
        // Get preview container
        this.previewContainer = this.container.querySelector('.preview-canvas-container');

        // Upload elements
        this.uploadBtn = this.container.querySelector('#upload-video-btn');
        this.fileInput = this.container.querySelector('#video-file-input');
        this.dropZone = this.container.querySelector('#drop-zone');
        this.dropOverlay = this.container.querySelector('#drop-overlay');
    }

    /**
     * Setup landscape canvas
     */
    setupCanvas() {
        if (!this.landscapeCanvas || !this.sourceVideo) return;
        
        // Wait for video dimensions to be available
        const setupCanvasSize = () => {
            const videoWidth = this.sourceVideo.videoWidth || 1920;
            const videoHeight = this.sourceVideo.videoHeight || 1080;
            const videoAspect = videoWidth / videoHeight;
            const maxWidth = this.constants.CANVAS.MAX_WIDTH;
            const maxHeight = this.constants.CANVAS.MAX_HEIGHT;
            
            let canvasWidth, canvasHeight;
            
            if (videoAspect > maxWidth / maxHeight) {
                canvasWidth = maxWidth;
                canvasHeight = maxWidth / videoAspect;
            } else {
                canvasHeight = maxHeight;
                canvasWidth = maxHeight * videoAspect;
            }
            
            this.landscapeCanvas.width = canvasWidth;
            this.landscapeCanvas.height = canvasHeight;
            
            // Set rendering quality
            if (this.landscapeCtx) {
                this.landscapeCtx.imageSmoothingEnabled = true;
                this.landscapeCtx.imageSmoothingQuality = 'high';
            }
        };
        
        if (this.sourceVideo.videoWidth > 0) {
            setupCanvasSize();
        } else {
            this.sourceVideo.addEventListener('loadedmetadata', setupCanvasSize, { once: true });
        }
    }

    /**
     * Initialize editor modules
     */
    initializeModules() {
        try {
            // Initialize selection controller
            this.selectionController = new window.SelectionController(this, this.landscapeCanvas);
            
            // Initialize frame recorder
            this.frameRecorder = new window.FrameRecorder();
            
            // Initialize preview renderer
            this.previewRenderer = new window.PreviewRenderer(this, this.sourceVideo);
            
            // Add preview canvas to UI
            if (this.previewContainer) {
                this.previewContainer.appendChild(this.previewRenderer.getCanvas());
            }
        } catch (error) {
            this.utils.Logger.error('Error initializing modules:', error);
            throw error;
        }
    }

    /**
     * Attach event listeners
     */
    attachEventListeners() {
        // Video events
        this.sourceVideo.addEventListener('timeupdate', this.handleVideoTimeUpdate);
        this.sourceVideo.addEventListener('loadedmetadata', this.handleVideoLoadedMetadata);
        this.sourceVideo.addEventListener('ended', this.handleVideoEnded.bind(this));
        
        // Control events - with null checks
        this.controls.playPause?.addEventListener('click', this.handlePlayPause);
        this.controls.stop?.addEventListener('click', this.handleStop);
        this.controls.restart?.addEventListener('click', this.handleRestart.bind(this));
        this.controls.record?.addEventListener('click', this.handleRecord);
        this.controls.export?.addEventListener('click', this.handleExport);
        this.controls.downloadOriginal?.addEventListener('click', this.handleDownloadOriginal.bind(this));
        
        // Timeline events
        this.timeline.track?.addEventListener('click', this.handleTimelineClick.bind(this));
        
        // Frame recorder events
        document.addEventListener('frameRecorderEvent', this.handleFrameRecorderEvent.bind(this));

        // Upload events
        this.uploadBtn?.addEventListener('click', this.handleUploadClick.bind(this));
        this.fileInput?.addEventListener('change', this.handleFileSelect.bind(this));
        
        // Drag & Drop events
        this.dropZone?.addEventListener('dragover', this.handleDragOver.bind(this));
        this.dropZone?.addEventListener('dragleave', this.handleDragLeave.bind(this));
        this.dropZone?.addEventListener('drop', this.handleDrop.bind(this));
    }

    /**
     * Handle upload button click
     */
    handleUploadClick() {
        this.fileInput?.click();
    }

    /**
     * Handle file selection
     */
    async handleFileSelect(event) {
        const file = event.target.files?.[0];
        if (file) {
            await this.loadVideoFile(file);
        }
    }

    /**
     * Handle drag over
     */
    handleDragOver(event) {
        event.preventDefault();
        event.stopPropagation();
        
        this.dropZone?.classList.add('drag-over');
        this.dropOverlay?.classList.add('visible');
    }

    /**
     * Handle drag leave
     */
    handleDragLeave(event) {
        event.preventDefault();
        event.stopPropagation();
        
        // Only hide if leaving the drop zone completely
        if (!this.dropZone?.contains(event.relatedTarget)) {
            this.dropZone?.classList.remove('drag-over');
            this.dropOverlay?.classList.remove('visible');
        }
    }

    /**
     * Handle file drop
     */
    async handleDrop(event) {
        event.preventDefault();
        event.stopPropagation();
        
        this.dropZone?.classList.remove('drag-over');
        this.dropOverlay?.classList.remove('visible');
        
        const files = event.dataTransfer?.files;
        if (files && files.length > 0) {
            const file = files[0];
            
            // Validate file type
            if (file.type.startsWith('video/')) {
                await this.loadVideoFile(file);
            } else {
                this.showError('Please select a valid video file');
            }
        }
    }

    /**
     * Load video file
     */
    async loadVideoFile(file) {
        try {
            this.utils.Logger.info('📁 Loading uploaded video file...', {
                name: file.name,
                size: `${Math.round(file.size / 1024 / 1024)}MB`,
                type: file.type
            });
            
            this.showUploadProgress('Validating file...', 0);
            
            // Validate file
            if (!this.validateVideoFile(file)) return;
            
            this.showUploadProgress('Creating video URL...', 25);
            
            // Create blob URL from file
            const blobUrl = URL.createObjectURL(file);
            this.utils.Logger.info('✅ Blob URL created:', blobUrl);
            
            this.showUploadProgress('Loading video...', 50);
            
            // Load video
            await this.loadVideoFromBlob(blobUrl, file);
            
            this.showUploadProgress('Video loaded successfully!', 100);
            
            // Hide progress after delay
            setTimeout(() => this.hideUploadProgress(), 1500);
            
            this.utils.Logger.info('✅ Video file loaded successfully!');
            
        } catch (error) {
            this.utils.Logger.error('❌ Failed to load video file:', error);
            this.showError(`Failed to load video: ${error.message}`);
            this.hideUploadProgress();
        }
    }

    
    /**
     * Validate video file
     */
    validateVideoFile(file) {
        const maxSize = 1000 * 1024 * 1024; // 1GB (aumentado)
        const supportedTypes = [
            'video/mp4', 
            'video/webm', 
            'video/ogg', 
            'video/mov', 
            'video/avi',
            'video/quicktime'
        ];
        
        if (file.size > maxSize) {
            this.showError('File too large. Maximum size: 1GB');
            return false;
        }
        
        // Check if file type contains any supported format
        const isSupported = supportedTypes.some(type => {
            const format = type.split('/')[1];
            return file.type.toLowerCase().includes(format) || 
                file.name.toLowerCase().includes(`.${format}`);
        });
        
        if (!isSupported) {
            this.showError('Unsupported file format. Use MP4, WebM, MOV, AVI, or OGG');
            return false;
        }
        
        return true;
    }

    /**
     * Load video from blob URL
     */
    async loadVideoFromBlob(blobUrl, file) {
        // Pause current video
        this.sourceVideo.pause();
        
        // Update source
        this.sourceVideo.src = blobUrl;
        this.sourceVideo.preload = 'metadata';
        this.videoBlob = file;
        this.canManipulate = true;
        
        // Store original filename
        this.uploadedFileName = file.name;
        
        // Wait for video to load
        return new Promise((resolve, reject) => {
            const onLoadedMetadata = () => {
                this.sourceVideo.removeEventListener('loadedmetadata', onLoadedMetadata);
                this.sourceVideo.removeEventListener('error', onError);
                
                this.duration = this.sourceVideo.duration;
                
                // Update UI
                this.updateVideoInfo();
                
                // ✅ CORRIGIDO: Usar clearKeyframes ao invés de reset
                if (this.frameRecorder) {
                    this.frameRecorder.clearKeyframes();
                    this.frameRecorder.stopRecording(); // Para se estiver gravando
                }
                
                resolve();
            };

            const onError = (error) => {
                this.sourceVideo.removeEventListener('loadedmetadata', onLoadedMetadata);
                this.sourceVideo.removeEventListener('error', onError);
                reject(new Error('Failed to load uploaded video'));
            };

            this.sourceVideo.addEventListener('loadedmetadata', onLoadedMetadata);
            this.sourceVideo.addEventListener('error', onError);
            
            // ✅ CORRIGIDO: Timeout maior para uploads locais
            setTimeout(() => reject(new Error('Video load timeout')), 30000); // 30 segundos
        });
    }

    /**
     * Update video info after upload
     */
    updateVideoInfo() {
        // Update duration display
        if (this.infoElements.duration) {
            this.infoElements.duration.textContent = `/ ${this.formatTime(this.duration)}`;
        }
        
        // Update header to show uploaded file
        const header = this.container.querySelector('.editor-header h3');
        if (header && this.uploadedFileName) {
            header.textContent = `🎬 ${this.uploadedFileName}`;
        }
        
        // Reset timeline
        this.updateTimelinePosition();
    }

    /**
     * Show upload progress
     */
    showUploadProgress(message, percent) {
        // Remove existing progress
        this.hideUploadProgress();
        
        const progressDiv = document.createElement('div');
        progressDiv.className = 'upload-progress';
        progressDiv.innerHTML = `
            <div class="upload-message">${message}</div>
            <div class="upload-progress-bar">
                <div class="upload-progress-fill" style="width: ${percent}%"></div>
            </div>
            <div class="upload-percent">${percent}%</div>
        `;
        
        // Add to container instead of body
        this.container.appendChild(progressDiv);
    }

    /**
     * Hide upload progress
     */
    hideUploadProgress() {
        const progressDiv = this.container.querySelector('.upload-progress');
        if (progressDiv) {
            progressDiv.remove();
        }
    }

    /**
     * Show error message
     */
    showError(message) {
        const errorDiv = document.createElement('div');
        errorDiv.style.cssText = `
            position: fixed; top: 20px; right: 20px; 
            background: rgba(220, 53, 69, 0.9); color: white;
            padding: 12px 16px; border-radius: 8px; z-index: 9999999;
            font-size: 14px; font-weight: 500; max-width: 300px;
            box-shadow: 0 4px 12px rgba(220, 53, 69, 0.3);
        `;
        errorDiv.innerHTML = `❌ ${message}`;
        document.body.appendChild(errorDiv);
        
        setTimeout(() => errorDiv.remove(), 5000);
    }

    /**
     * Handle selection change from selection controller
     * @param {Object} selectionData - New selection data
     */
    handleSelectionChange(selectionData) {
        // Update preview renderer
        this.previewRenderer?.updateSelection(selectionData);
        
        // Update info display
        this.updateSelectionInfo(selectionData);
        
        // Record keyframe if recording
        if (this.frameRecorder?.getRecordingStatus()) {
            this.frameRecorder.recordKeyframe(this.currentTime, selectionData);
        }
    }

    /**
     * Handle video time updates
     */
    handleVideoTimeUpdate() {
        this.currentTime = this.sourceVideo.currentTime;
        this.updateTimeDisplay();
        this.updateTimelinePosition();
        this.drawVideoFrame();
        
        // Update frame recorder time
        this.frameRecorder?.updateTime(this.currentTime);
    }

    /**
     * Handle video metadata loaded
     */
    handleVideoLoadedMetadata() {
        this.duration = this.sourceVideo.duration;
        if (this.infoElements.duration) {
            this.infoElements.duration.textContent = `/ ${this.formatTime(this.duration)}`;
        }
    }

    /**
     * Handle video ended
     */
    handleVideoEnded() {
        this.isPlaying = false;
        this.updatePlayPauseButton();
        
        // Stop recording if active
        if (this.frameRecorder?.getRecordingStatus()) {
            this.handleRecord();
        }
    }

    /**
     * Handle play/pause button
     */
    handlePlayPause() {
        if (this.isPlaying) {
            this.sourceVideo.pause();
            this.isPlaying = false;
        } else {
            this.sourceVideo.play();
            this.isPlaying = true;
        }
        
        this.updatePlayPauseButton();
    }

    /**
     * Handle stop button
     */
    handleStop() {
        this.sourceVideo.pause();
        this.sourceVideo.currentTime = 0;
        this.isPlaying = false;
        this.updatePlayPauseButton();
        
        // Stop recording if active
        if (this.frameRecorder?.getRecordingStatus()) {
            this.frameRecorder.stopRecording();
            this.updateRecordingState();
        }
    }

    /**
     * Handle restart button
     */
    handleRestart() {
        this.sourceVideo.currentTime = 0;
        this.updateTimeDisplay();
        this.updateTimelinePosition();
    }

    /**
     * Handle record button
     */
    handleRecord() {
        if (this.frameRecorder?.getRecordingStatus()) {
            // Stop recording
            this.frameRecorder.stopRecording();
            this.currentMode = 'preview';
        } else {
            // Start recording
            this.frameRecorder?.startRecording(this.duration);
            this.currentMode = 'record';
        }
        
        this.updateRecordingState();
    }

    /**
     * Handle export button
     */
    async handleExport() {
        try {
            this.currentMode = 'export';
            this.updateModeDisplay();
            
            const exportData = this.frameRecorder?.exportKeyframes();
            
            if (!exportData || exportData.totalKeyframes === 0) {
                alert('No keyframes recorded. Please record some motion first.');
                this.currentMode = 'preview';
                this.updateModeDisplay();
                return;
            }
            
            // Start export process
            await this.exportVideo(exportData);
            
        } catch (error) {
            this.utils.Logger.error('Export failed:', error);
            alert('Export failed. Please try again.');
        } finally {
            this.currentMode = 'preview';
            this.updateModeDisplay();
        }
    }

    /**
     * Handle download original button
     */
    handleDownloadOriginal() {
        // Use existing video downloader
        if (window.videoDownloader) {
            window.videoDownloader.downloadVideo(this.videoSrc);
        }
    }

    /**
     * Handle timeline click
     * @param {MouseEvent} event - Click event
     */
    handleTimelineClick(event) {
        if (!this.timeline.track) return;
        
        const rect = this.timeline.track.getBoundingClientRect();
        const clickX = event.clientX - rect.left;
        const progress = clickX / rect.width;
        const newTime = progress * this.duration;
        
        this.sourceVideo.currentTime = Math.max(0, Math.min(this.duration, newTime));
    }

    /**
     * Handle frame recorder events
     * @param {CustomEvent} event - Frame recorder event
     */
    handleFrameRecorderEvent(event) {
        const { type, data } = event.detail;
        
        switch (type) {
            case 'keyframe':
                this.updateKeyframesDisplay();
                this.drawKeyframeIndicator(data.timestamp);
                break;
            case 'stopped':
                this.updateKeyframesDisplay();
                break;
        }
    }

    /**
     * Update selection info display
     * @param {Object} selectionData - Selection data
     */
    updateSelectionInfo(selectionData) {
        if (this.infoElements.coordinates) {
            this.infoElements.coordinates.textContent = `X: ${Math.round(selectionData.x)}, Y: ${Math.round(selectionData.y)}`;
        }
        if (this.infoElements.dimensions) {
            this.infoElements.dimensions.textContent = `W: ${Math.round(selectionData.width)}, H: ${Math.round(selectionData.height)}`;
        }
        if (this.infoElements.zoomLevel) {
            this.infoElements.zoomLevel.textContent = `Zoom: ${Math.round(selectionData.zoom * 100)}%`;
        }
    }

    /**
     * Update time display
     */
    updateTimeDisplay() {
        if (this.infoElements.currentTime) {
            this.infoElements.currentTime.textContent = this.formatTime(this.currentTime);
        }
    }

    /**
     * Update timeline position
     */
    updateTimelinePosition() {
        const progress = this.duration > 0 ? (this.currentTime / this.duration) * 100 : 0;
        
        if (this.timeline.progress) {
            this.timeline.progress.style.width = `${progress}%`;
        }
        if (this.timeline.scrubber) {
            this.timeline.scrubber.style.left = `${progress}%`;
        }
    }

    /**
     * Update play/pause button
     */
    updatePlayPauseButton() {
        const icon = this.controls.playPause?.querySelector('.icon');
        if (icon) {
            icon.textContent = this.isPlaying ? '⏸️' : '▶️';
        }
    }

    /**
     * Update recording state
     */
    updateRecordingState() {
        const isRecording = this.frameRecorder?.getRecordingStatus();
        
        // Update button
        const recordIcon = this.controls.record?.querySelector('.icon');
        const recordText = this.controls.record?.querySelector('.text');
        if (recordIcon) recordIcon.textContent = isRecording ? '⏹️' : '⏺️';
        if (recordText) recordText.textContent = isRecording ? 'Stop Recording' : 'Record Motion';
        
        // Update recording indicator
        if (isRecording) {
            this.infoElements.recordingIndicator?.classList.remove('hidden');
        } else {
            this.infoElements.recordingIndicator?.classList.add('hidden');
        }
        
        // Update container class
        if (isRecording) {
            this.container?.classList.add(this.cssClasses.RECORDING);
        } else {
            this.container?.classList.remove(this.cssClasses.RECORDING);
        }
        
        this.updateModeDisplay();
    }

    /**
     * Update mode display
     */
    updateModeDisplay() {
        const modeNames = {
            'preview': 'Preview Mode',
            'record': 'Recording Mode', 
            'edit': 'Edit Mode',
            'export': 'Exporting...'
        };
        
        if (this.infoElements.modeText) {
            this.infoElements.modeText.textContent = modeNames[this.currentMode] || 'Unknown Mode';
        }
    }

    /**
     * Update keyframes display
     */
    updateKeyframesDisplay() {
        const stats = this.frameRecorder?.getRecordingStats();
        if (!stats) return;
        
        if (this.infoElements.keyframesCount) {
            this.infoElements.keyframesCount.textContent = stats.totalKeyframes;
        }
        if (this.infoElements.recordingDuration) {
            this.infoElements.recordingDuration.textContent = this.formatTime(stats.lastKeyframe || 0);
        }
    }

    /**
     * Draw keyframe indicator on timeline
     * @param {number} timestamp - Keyframe timestamp
     */
    drawKeyframeIndicator(timestamp) {
        if (!this.timeline.keyframesContainer || this.duration <= 0) return;
        
        const progress = (timestamp / this.duration) * 100;
        
        const indicator = this.utils.DOMUtils.createElement('div', {
            className: 'keyframe-indicator',
            styles: {
                left: `${progress}%`,
                position: 'absolute',
                top: '50%',
                transform: 'translateY(-50%)',
                width: `${this.constants.TIMELINE?.KEYFRAME_INDICATOR_SIZE || 6}px`,
                height: `${this.constants.TIMELINE?.KEYFRAME_INDICATOR_SIZE || 6}px`,
                backgroundColor: this.constants.TIMELINE?.KEYFRAME_COLOR || '#4ECDC4',
                borderRadius: '50%',
                zIndex: '10'
            }
        });
        
        this.timeline.keyframesContainer.appendChild(indicator);
    }

    /**
     * Draw video frame with graceful fallback
     */
    drawVideoFrame() {
        if (!this.landscapeCtx) return;
        
        this.landscapeCtx.clearRect(0, 0, this.landscapeCanvas.width, this.landscapeCanvas.height);
        
        if (this.canManipulate && this.sourceVideo.videoWidth > 0) {
            try {
                this.landscapeCtx.drawImage(
                    this.sourceVideo,
                    0, 0, this.sourceVideo.videoWidth, this.sourceVideo.videoHeight,
                    0, 0, this.landscapeCanvas.width, this.landscapeCanvas.height
                );
                return;
            } catch (error) {
                // Fall through to placeholder
            }
        }
        
        // Draw placeholder
        this.drawPlaceholder();
    }

    /**
     * Draw placeholder when video unavailable
     */
    drawPlaceholder() {
        this.landscapeCtx.fillStyle = '#1a1a1a';
        this.landscapeCtx.fillRect(0, 0, this.landscapeCanvas.width, this.landscapeCanvas.height);
        
        this.landscapeCtx.fillStyle = '#666';
        this.landscapeCtx.font = '18px Arial';
        this.landscapeCtx.textAlign = 'center';
        this.landscapeCtx.fillText(
            '🎬 Video Preview',
            this.landscapeCanvas.width / 2,
            this.landscapeCanvas.height / 2 - 10
        );
        
        this.landscapeCtx.font = '14px Arial';
        this.landscapeCtx.fillText(
            'Selection controls active',
            this.landscapeCanvas.width / 2,
            this.landscapeCanvas.height / 2 + 15
        );
    }

    /**
     * Export video with recorded keyframes
     * @param {Object} exportData - Export data from frame recorder
     */
    async exportVideo(exportData) {
        this.utils.Logger.info('Export started with', exportData.totalKeyframes, 'keyframes');
        
        // For now, just show success message
        alert(`Export completed! 

Keyframes: ${exportData.totalKeyframes}
Duration: ${this.formatTime(exportData.duration)}

This is a demo - actual video export functionality would be implemented here.`);
    }

    /**
     * Format time in MM:SS format
     * @param {number} seconds - Time in seconds
     * @returns {string} Formatted time
     */
    formatTime(seconds) {
        const mins = Math.floor(seconds / 60);
        const secs = Math.floor(seconds % 60);
        return `${mins.toString().padStart(2, '0')}:${secs.toString().padStart(2, '0')}`;
    }

    /**
     * Get editor container element
     * @returns {HTMLElement}
     */
    getContainer() {
        return this.container;
    }

    /**
     * Get current editor state
     * @returns {Object}
     */
    getState() {
        return {
            isInitialized: this.isInitialized,
            currentMode: this.currentMode,
            isPlaying: this.isPlaying,
            currentTime: this.currentTime,
            duration: this.duration,
            recordingStats: this.frameRecorder?.getRecordingStats()
        };
    }

    /**
     * Selection change callback (called by SelectionController)
     * @param {Object} selectionData - New selection data
     */
    onSelectionChanged(selectionData) {
        this.handleSelectionChange(selectionData);
    }

    /**
     * Cleanup resources
     */
    cleanup() {
        // Stop video
        this.sourceVideo.pause();
        
        // Cleanup modules
        if (this.selectionController) {
            this.selectionController.cleanup();
        }
        
        if (this.frameRecorder) {
            this.frameRecorder.cleanup();
        }
        
        if (this.previewRenderer) {
            this.previewRenderer.cleanup();
        }
        
        // Remove event listeners
        this.sourceVideo.removeEventListener('timeupdate', this.handleVideoTimeUpdate);
        this.sourceVideo.removeEventListener('loadedmetadata', this.handleVideoLoadedMetadata);
        
        // Clear container
        if (this.container && this.container.parentNode) {
            this.container.parentNode.removeChild(this.container);
        }
        
        this.isInitialized = false;

        // Hide progress if still showing
        this.hideDownloadProgress();
        
        this.isInitialized = false;
    }

    showDownloadProgress(message) { /* código acima */ }
    hideDownloadProgress() { /* código acima */ }
    updateDownloadProgress(message, percent) { /* código acima */ }
}

// Export for use in popup manager
if (typeof window !== 'undefined') {
    window.VideoEditor = VideoEditor;
    window.VideoProcessor = VideoProcessor;
    window.videoProcessor = new VideoProcessor();
}