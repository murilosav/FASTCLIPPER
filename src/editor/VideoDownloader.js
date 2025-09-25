/**
 * Real Video Downloader with Local Storage
 */
class VideoDownloader {
    constructor() {
        this.utils = window.TWITCH_CLIP_EDITOR_UTILS;
        this.downloadedVideos = new Map(); // Cache de vídeos baixados
    }

    /**
     * Download video to memory and return blob URL
     * @param {string} videoUrl - Video URL to download
     * @returns {Promise<string>} Local blob URL
     */
    async downloadToMemory(videoUrl) {
        try {
            this.utils.Logger.info('📥 Downloading video to memory...', videoUrl);
            
            // Check cache first
            if (this.downloadedVideos.has(videoUrl)) {
                this.utils.Logger.info('✅ Using cached video');
                return this.downloadedVideos.get(videoUrl);
            }

            // Download with proper headers
            const response = await fetch(videoUrl, {
                method: 'GET',
                headers: {
                    'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36',
                    'Referer': 'https://www.twitch.tv/'
                }
            });

            if (!response.ok) {
                throw new Error(`Download failed: ${response.status} ${response.statusText}`);
            }

            const videoBlob = await response.blob();
            const blobUrl = URL.createObjectURL(videoBlob);
            
            // Cache for reuse
            this.downloadedVideos.set(videoUrl, blobUrl);
            
            this.utils.Logger.info('✅ Video downloaded successfully!', {
                size: videoBlob.size,
                type: videoBlob.type
            });

            return blobUrl;

        } catch (error) {
            this.utils.Logger.error('❌ Failed to download video:', error);
            throw new Error(`Download failed: ${error.message}`);
        }
    }

    /**
     * Download video to disk using Chrome Downloads API
     * @param {string} videoUrl - Video URL
     * @param {string} filename - Filename for download
     */
    async downloadToDisk(videoUrl, filename = 'twitch-clip.mp4') {
        try {
            const downloadId = await chrome.downloads.download({
                url: videoUrl,
                filename: filename,
                conflictAction: 'overwrite'
            });

            return new Promise((resolve, reject) => {
                chrome.downloads.onChanged.addListener(function listener(delta) {
                    if (delta.id === downloadId && delta.state?.current === 'complete') {
                        chrome.downloads.onChanged.removeListener(listener);
                        resolve(downloadId);
                    } else if (delta.id === downloadId && delta.state?.current === 'interrupted') {
                        chrome.downloads.onChanged.removeListener(listener);
                        reject(new Error('Download interrupted'));
                    }
                });
            });

        } catch (error) {
            this.utils.Logger.error('Failed to download to disk:', error);
            throw error;
        }
    }

    /**
     * Store video in IndexedDB for large files
     */
    async storeInIndexedDB(videoBlob, videoUrl) {
        return new Promise((resolve, reject) => {
            const request = indexedDB.open('TwitchClipEditor', 1);
            
            request.onupgradeneeded = (e) => {
                const db = e.target.result;
                if (!db.objectStoreNames.contains('videos')) {
                    db.createObjectStore('videos', { keyPath: 'url' });
                }
            };
            
            request.onsuccess = (e) => {
                const db = e.target.result;
                const transaction = db.transaction(['videos'], 'readwrite');
                const store = transaction.objectStore('videos');
                
                store.put({
                    url: videoUrl,
                    blob: videoBlob,
                    timestamp: Date.now()
                });
                
                transaction.oncomplete = () => resolve();
                transaction.onerror = () => reject(transaction.error);
            };
            
            request.onerror = () => reject(request.error);
        });
    }

    /**
     * Download video to memory and return blob URL
     * @param {string} videoUrl - Video URL to download
     * @returns {Promise<string>} Local blob URL
     */
    async downloadToMemory(videoUrl) {
        try {
            this.utils.Logger.info('📥 Downloading video to memory...', videoUrl);
            
            // Download with proper headers
            const response = await fetch(videoUrl, {
                method: 'GET',
                headers: {
                    'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36',
                    'Referer': 'https://www.twitch.tv/'
                }
            });

            if (!response.ok) {
                throw new Error(`Download failed: ${response.status} ${response.statusText}`);
            }

            const videoBlob = await response.blob();
            const blobUrl = URL.createObjectURL(videoBlob);
            
            this.utils.Logger.info('✅ Video downloaded successfully!', {
                size: videoBlob.size,
                type: videoBlob.type
            });

            return blobUrl;

        } catch (error) {
            this.utils.Logger.error('❌ Failed to download video:', error);
            throw new Error(`Download failed: ${error.message}`);
        }
    }

    /**
     * Clean up cached videos
     */
    cleanup() {
        this.downloadedVideos.forEach((blobUrl) => {
            URL.revokeObjectURL(blobUrl);
        });
        this.downloadedVideos.clear();
    }
}


// Export
if (typeof window !== 'undefined') {
    window.VideoDownloader = VideoDownloader;
}
