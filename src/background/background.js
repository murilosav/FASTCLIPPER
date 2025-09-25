/**
 * Background Service Worker
 * Handles video downloads and file management
 */

class BackgroundVideoManager {
    constructor() {
        this.downloads = new Map(); // downloadId -> data
        this.localFiles = new Map(); // videoUrl -> localPath
    }

    /**
     * Download video to local filesystem
     */
    async downloadVideo(videoUrl, tabId) {
        try {
            console.log('📥 Background: Starting video download...', videoUrl);
            
            const filename = `twitch-clips/clip-${Date.now()}.mp4`;
            
            const downloadId = await chrome.downloads.download({
                url: videoUrl,
                filename: filename,
                conflictAction: 'overwrite'
            });

            // Store download info
            this.downloads.set(downloadId, {
                videoUrl,
                tabId,
                filename,
                status: 'downloading'
            });

            console.log('✅ Download started:', downloadId);
            return downloadId;

        } catch (error) {
            console.error('❌ Download failed:', error);
            throw error;
        }
    }

    /**
     * Get local file path for video
     */
    async getLocalFile(videoUrl) {
        return this.localFiles.get(videoUrl) || null;
    }

    /**
     * Handle download completion
     */
    handleDownloadCompleted(downloadId) {
        const downloadInfo = this.downloads.get(downloadId);
        if (!downloadInfo) return;

        console.log('✅ Download completed:', downloadId);
        
        // Get the actual file path
        chrome.downloads.search({ id: downloadId }, (results) => {
            if (results && results[0]) {
                const filePath = results[0].filename;
                this.localFiles.set(downloadInfo.videoUrl, filePath);
                
                // Notify content script
                chrome.tabs.sendMessage(downloadInfo.tabId, {
                    type: 'VIDEO_DOWNLOADED',
                    videoUrl: downloadInfo.videoUrl,
                    localPath: filePath,
                    downloadId: downloadId
                });
            }
        });

        downloadInfo.status = 'completed';
    }
}

// Initialize manager
const videoManager = new BackgroundVideoManager();

// Listen for download events
chrome.downloads.onChanged.addListener((delta) => {
    if (delta.state?.current === 'complete') {
        videoManager.handleDownloadCompleted(delta.id);
    }
});

// Listen for messages from content script
chrome.runtime.onMessage.addListener((request, sender, sendResponse) => {
    switch (request.type) {
        case 'DOWNLOAD_VIDEO':
            videoManager.downloadVideo(request.videoUrl, sender.tab.id)
                .then(downloadId => sendResponse({ success: true, downloadId }))
                .catch(error => sendResponse({ success: false, error: error.message }));
            return true; // Keep channel open for async response

        case 'GET_LOCAL_FILE':
            videoManager.getLocalFile(request.videoUrl)
                .then(localPath => sendResponse({ localPath }))
                .catch(error => sendResponse({ error: error.message }));
            return true;
    }
});


chrome.runtime.onMessage.addListener((message, sender, sendResponse) => {
    if (message.type === 'downloadVideo') {
        const { videoUrl } = message;
        chrome.downloads.download({
            url: videoUrl,
            filename: `twitch-clip-${Date.now()}.mp4`,
            conflictAction: 'overwrite',
            saveAs: false
        }, (downloadId) => {
            if (chrome.runtime.lastError) {
                sendResponse({ success: false, error: chrome.runtime.lastError.message });
                return;
            }
            chrome.downloads.onChanged.addListener(function listener(delta) {
                if (delta.id === downloadId && delta.state?.current === 'complete') {
                    chrome.downloads.onChanged.removeListener(listener);
                    chrome.downloads.search({ id: downloadId }, (results) => {
                        if (results.length > 0) {
                            const fileEntry = results[0];
                            // Note: Direct blob access is not possible; we need a workaround
                            sendResponse({
                                success: true,
                                localUrl: `file://${fileEntry.filename.replace(/\\/g, '/')}`, // Placeholder
                                size: fileEntry.fileSize,
                                error: null
                            });
                        } else {
                            sendResponse({ success: false, error: 'Download result not found' });
                        }
                    });
                } else if (delta.id === downloadId && delta.state?.current === 'interrupted') {
                    sendResponse({ success: false, error: 'Download interrupted' });
                }
            });
        });
        return true; // Indica resposta assíncrona
    }
});