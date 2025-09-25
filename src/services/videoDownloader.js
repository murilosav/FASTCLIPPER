/**
 * Video Downloader Module
 * Handles video detection, capture, and download functionality
 */

class VideoDownloader {
    constructor() {
        this.currentVideoSrc = null;
        this.isSearching = false;
        this.searchInterval = null;
        
        // Get utilities and constants
        this.constants = window.TWITCH_CLIP_EDITOR_CONSTANTS;
        this.utils = window.TWITCH_CLIP_EDITOR_UTILS;
    }

    /**
     * Start searching for video source
     * @returns {Promise<string>} Video source URL
     */
    async searchForVideo() {
        return new Promise((resolve, reject) => {
            // Se já está buscando, aguarda a busca atual ao invés de rejeitar
            if (this.isSearching) {
                this.utils.Logger.info('Search already in progress, waiting for result...');
                
                // Aguarda a busca atual terminar
                const waitForCurrentSearch = setInterval(() => {
                    if (!this.isSearching) {
                        clearInterval(waitForCurrentSearch);
                        if (this.currentVideoSrc) {
                            resolve(this.currentVideoSrc);
                        } else {
                            // Se a busca atual falhou, inicia nova busca
                            this.startNewSearch(resolve, reject);
                        }
                    }
                }, 100);
                return;
            }

            this.startNewSearch(resolve, reject);
        });
    }

    /**
     * Start a new search process
     * @param {Function} resolve - Promise resolve function
     * @param {Function} reject - Promise reject function
    */
    startNewSearch(resolve, reject) {
        this.isSearching = true;
        let attempts = 0;

        this.searchInterval = setInterval(() => {
            attempts++;
            
            const videoSrc = this.findVideoSource();
            
            if (videoSrc) {
                this.stopVideoSearch();
                this.currentVideoSrc = videoSrc;
                this.utils.Logger.info(`${this.constants.MESSAGES.VIDEO_CAPTURED} (attempt ${attempts})`);
                resolve(videoSrc);
                return;
            }

            // Log a cada 50 tentativas para debug
            if (attempts % 50 === 0) {
                this.utils.Logger.info(`Still searching for video... (${attempts} attempts)`);
            }

        }, this.constants.TIMING_CONFIG.VIDEO_SEARCH_INTERVAL);
    }

    /**
     * Stop video search
     */
    stopVideoSearch() {
        this.isSearching = false;
        if (this.searchInterval) {
            clearInterval(this.searchInterval);
            this.searchInterval = null;
        }
    }

    /**
     * Find video source from DOM
     * @returns {string|null} Video source URL
     */
    findVideoSource() {
        const videos = document.querySelectorAll(this.constants.TWITCH_SELECTORS.VIDEO_ELEMENTS);
        
        for (const video of videos) {
            if (this.utils.VideoUtils.isValidVideoSource(video.src)) {
                return video.src;
            }
        }
        
        return null;
    }

    /**
     * Download video from URL
     * @param {string} videoSrc - Video source URL
     * @param {string} filename - Optional custom filename
     * @returns {boolean} Success status
     */
    downloadVideo(videoSrc = null, filename = null) {
        try {
            const src = videoSrc || this.currentVideoSrc;
            if (!src) {
                throw new Error('No video source available');
            }

            const downloadFilename = filename || this.utils.VideoUtils.generateFilename();
            
            // Create temporary download link
            const downloadLink = this.utils.DOMUtils.createElement('a', {
                attributes: {
                    href: src,
                    download: downloadFilename
                },
                styles: { display: 'none' }
            });

            // Add to DOM, click, and remove
            document.body.appendChild(downloadLink);
            downloadLink.click();
            document.body.removeChild(downloadLink);

            this.utils.Logger.info(this.constants.MESSAGES.DOWNLOAD_STARTED);
            return true;
            
        } catch (error) {
            this.utils.Logger.error(this.constants.MESSAGES.DOWNLOAD_ERROR, error);
            this.showDownloadError();
            return false;
        }
    }

    /**
     * Show download error to user
     */
    showDownloadError() {
        alert('Unable to download video. Please try right-click > Save video as...');
    }

    /**
     * Get all available video sources on page
     * @returns {Array<{element: Element, src: string}>}
     */
    getAllVideoSources() {
        const videos = document.querySelectorAll(this.constants.TWITCH_SELECTORS.VIDEO_ELEMENTS);
        const sources = [];

        videos.forEach(video => {
            if (this.utils.VideoUtils.isValidVideoSource(video.src)) {
                sources.push({
                    element: video,
                    src: video.src
                });
            }
        });

        return sources;
    }

    /**
     * Get current video source
     * @returns {string|null}
     */
    getCurrentVideoSource() {
        return this.currentVideoSrc;
    }

    /**
     * Set current video source
     * @param {string} src - Video source URL
     */
    setCurrentVideoSource(src) {
        if (this.utils.VideoUtils.isValidVideoSource(src)) {
            this.currentVideoSrc = src;
            return true;
        }
        return false;
    }

    /**
     * Clear current video source
     */
    clearCurrentVideoSource() {
        this.currentVideoSrc = null;
    }

    /**
     * Check if video is currently available
     * @returns {boolean}
     */
    hasVideoSource() {
        return !!this.currentVideoSrc;
    }

    /**
     * Get video metadata
     * @param {string} videoSrc - Video source URL
     * @returns {Object} Video metadata
     */
    getVideoMetadata(videoSrc = null) {
        const src = videoSrc || this.currentVideoSrc;
        if (!src) return null;

        return {
            src,
            isBlob: src.startsWith('blob:'),
            isTwitchCDN: src.includes('twitchcdn.net'),
            timestamp: Date.now(),
            filename: this.utils.VideoUtils.generateFilename()
        };
    }

    /**
     * Validate video source
     * @param {string} src - Video source URL
     * @returns {boolean}
     */
    isValidVideo(src) {
        return this.utils.VideoUtils.isValidVideoSource(src);
    }

    /**
     * Cleanup resources
     */
    cleanup() {
        this.stopVideoSearch();
        this.clearCurrentVideoSource();
    }
}

// Export for use in main content script
if (typeof window !== 'undefined') {
    window.VideoDownloader = VideoDownloader;
}