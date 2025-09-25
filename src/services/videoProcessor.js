/**
 * Video Processor - Robust Download Implementation with Error Handling
 */

class VideoProcessor {
    constructor() {
        this.utils = window.TWITCH_CLIP_EDITOR_UTILS;
        this.cache = new Map();
        this.onProgress = null;
        this.maxRetries = 3;
        this.retryDelay = 1000; // 1 second
    }

    /**
     * Download video with multiple fallback methods
     */
    async downloadAndProcess(videoUrl) {
        try {
            this.utils.Logger.info('📥 Requesting video download via background...', videoUrl);

            const response = await new Promise((resolve, reject) => {
                chrome.runtime.sendMessage(
                    { type: 'downloadVideo', videoUrl },
                    (response) => {
                        if (chrome.runtime.lastError) {
                            reject(new Error(chrome.runtime.lastError.message));
                        } else if (response.success) {
                            resolve(response);
                        } else {
                            reject(new Error(response.error || 'Unknown download error'));
                        }
                    }
                );
            });

            this.utils.Logger.info('✅ Download completed via background');
            return {
                localUrl: response.localUrl, // Placeholder; adjust with blob URL
                blob: null, // To be updated with actual blob
                originalUrl: videoUrl,
                canManipulate: false, // Update to true with blob
                downloadMethod: 'background-chrome-api',
                size: response.size
            };

        } catch (error) {
            this.utils.Logger.error('❌ Download failed:', error);
            throw error;
        }
    }

    /**
     * Method 1: Modern fetch API with proper headers
     */
    async downloadWithFetch(url) {
        const controller = new AbortController();
        const timeoutId = setTimeout(() => controller.abort(), 30000); // 30 second timeout

        try {
            const response = await fetch(url, {
                method: 'GET',
                headers: {
                    'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36',
                    'Accept': 'video/*, */*',
                    'Accept-Language': 'en-US,en;q=0.9',
                    'Cache-Control': 'no-cache',
                    'Pragma': 'no-cache'
                },
                signal: controller.signal,
                mode: 'cors'
            });

            clearTimeout(timeoutId);

            if (!response.ok) {
                throw new Error(`HTTP ${response.status}: ${response.statusText}`);
            }

            // Track progress if possible
            const contentLength = response.headers.get('content-length');
            if (contentLength && this.onProgress) {
                return this.trackFetchProgress(response, parseInt(contentLength));
            }

            return await response.blob();

        } catch (error) {
            clearTimeout(timeoutId);
            throw error;
        }
    }

    /**
     * Method 2: XMLHttpRequest with comprehensive error handling
     */
    async downloadWithXHR(url) {
        return new Promise((resolve, reject) => {
            const xhr = new XMLHttpRequest();
            
            // Configure request
            xhr.open('GET', url, true);
            xhr.responseType = 'blob';
            xhr.timeout = 45000; // 45 seconds
            
            // Set headers
            xhr.setRequestHeader('User-Agent', 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36');
            xhr.setRequestHeader('Accept', 'video/*, */*');
            xhr.setRequestHeader('Cache-Control', 'no-cache');
            
            // Progress tracking
            xhr.onprogress = (event) => {
                if (event.lengthComputable && this.onProgress) {
                    const percent = Math.round((event.loaded / event.total) * 100);
                    this.onProgress(percent);
                }
            };
            
            xhr.onload = () => {
                if (xhr.status >= 200 && xhr.status < 300) {
                    if (xhr.response && xhr.response.size > 0) {
                        resolve(xhr.response);
                    } else {
                        reject(new Error('Empty response received'));
                    }
                } else {
                    reject(new Error(`HTTP ${xhr.status}: ${xhr.statusText}`));
                }
            };
            
            xhr.onerror = () => {
                reject(new Error('Network error during XHR download'));
            };
            
            xhr.ontimeout = () => {
                reject(new Error('XHR download timeout'));
            };
            
            xhr.onabort = () => {
                reject(new Error('XHR download aborted'));
            };
            
            // Start download
            xhr.send();
        });
    }

    /**
     * Method 3: Fetch with alternative headers for CORS issues
     */
    async downloadWithFallbackHeaders(url) {
        try {
            const response = await fetch(url, {
                method: 'GET',
                headers: {
                    'User-Agent': 'Mozilla/5.0 (compatible; VideoDownloader/1.0)',
                    'Accept': '*/*',
                    'Origin': window.location.origin
                },
                mode: 'no-cors' // This might limit access to response details but could bypass CORS
            });

            // For no-cors mode, we might not be able to check response.ok
            return await response.blob();

        } catch (error) {
            throw new Error(`Fallback download failed: ${error.message}`);
        }
    }

    /**
     * Track fetch progress with readable stream
     */
    async trackFetchProgress(response, contentLength) {
        const reader = response.body.getReader();
        const chunks = [];
        let receivedLength = 0;

        while (true) {
            const { done, value } = await reader.read();
            
            if (done) break;
            
            chunks.push(value);
            receivedLength += value.length;
            
            if (this.onProgress) {
                const percent = Math.round((receivedLength / contentLength) * 100);
                this.onProgress(percent);
            }
        }

        // Combine chunks into blob
        return new Blob(chunks, { type: 'video/mp4' });
    }

    /**
     * Process successful download
     */
    async processSuccessfulDownload(videoBlob, originalUrl) {
        try {
            // Validate blob
            if (!videoBlob || videoBlob.size === 0) {
                throw new Error('Invalid or empty video blob');
            }

            // Create blob URL
            const blobUrl = URL.createObjectURL(videoBlob);
            
            const result = {
                localUrl: blobUrl,
                blob: videoBlob,
                originalUrl: originalUrl,
                canManipulate: true,
                downloadMethod: 'memory',
                size: videoBlob.size
            };
            
            // Cache the result
            this.cache.set(originalUrl, result);
            
            this.utils.Logger.info('✅ Video successfully downloaded to memory!', {
                size: `${Math.round(videoBlob.size / 1024 / 1024)}MB`,
                type: videoBlob.type,
                blobUrl: blobUrl
            });

            return result;

        } catch (error) {
            this.utils.Logger.error('❌ Failed to process downloaded blob:', error);
            throw error;
        }
    }

    /**
     * Create direct video result when download fails
     */
    createDirectVideoResult(originalUrl) {
        this.utils.Logger.info('📺 Using direct video URL (limited functionality)');
        
        return {
            localUrl: originalUrl,
            blob: null,
            originalUrl: originalUrl,
            canManipulate: false, // Limited canvas manipulation
            downloadMethod: 'direct',
            size: null
        };
    }

    /**
     * Set progress callback
     */
    setProgressCallback(callback) {
        this.onProgress = callback;
    }

    /**
     * Delay utility for retries
     */
    delay(ms) {
        return new Promise(resolve => setTimeout(resolve, ms));
    }

    /**
     * Check if URL is accessible
     */
    async testVideoUrl(url) {
        try {
            const response = await fetch(url, { method: 'HEAD' });
            return response.ok;
        } catch {
            return false;
        }
    }

    /**
     * Get video info without downloading
     */
    async getVideoInfo(url) {
        try {
            const response = await fetch(url, { method: 'HEAD' });
            
            return {
                size: response.headers.get('content-length'),
                type: response.headers.get('content-type'),
                accessible: response.ok
            };
        } catch (error) {
            return {
                size: null,
                type: 'video/mp4',
                accessible: false,
                error: error.message
            };
        }
    }

    /**
     * Clear cache and revoke URLs
     */
    cleanup() {
        this.cache.forEach((result) => {
            if (result.localUrl && result.localUrl.startsWith('blob:')) {
                URL.revokeObjectURL(result.localUrl);
            }
        });
        this.cache.clear();
        this.utils.Logger.info('🧹 Video processor cache cleaned');
    }

    /**
     * Get cache status
     */
    getCacheStatus() {
        return {
            totalCached: this.cache.size,
            urls: Array.from(this.cache.keys()),
            totalSize: Array.from(this.cache.values()).reduce((sum, result) => {
                return sum + (result.size || 0);
            }, 0)
        };
    }
}