/**
 * Frame Recorder Module
 * Records keyframes with selection position and exports video data
 */

class FrameRecorder {
    constructor() {
        // Recording state
        this.isRecording = false;
        this.keyframes = new Map(); // timestamp -> selection data
        this.currentTime = 0;
        this.videoDuration = 0;
        
        // Recording configuration
        this.recordingInterval = null;
        this.lastKeyframeTime = 0;
        
        // Get constants and utils
        this.constants = window.EDITOR_CONSTANTS;
        this.utils = window.TWITCH_CLIP_EDITOR_UTILS;
    }

    /**
     * Start recording keyframes
     * @param {number} videoDuration - Total video duration in seconds
     */
    startRecording(videoDuration) {
        if (this.isRecording) return;
        
        this.isRecording = true;
        this.videoDuration = videoDuration;
        this.keyframes.clear();
        this.currentTime = 0;
        this.lastKeyframeTime = 0;
        
        this.utils.Logger.info(this.constants.EDITOR_MESSAGES?.RECORDING_STARTED || 'Recording started');
        
        // Emit recording started event
        this.emitRecordingEvent('started');
    }

    /**
     * Stop recording keyframes
     */
    stopRecording() {
        if (!this.isRecording) return;
        
        this.isRecording = false;
        
        if (this.recordingInterval) {
            clearInterval(this.recordingInterval);
            this.recordingInterval = null;
        }
        
        this.utils.Logger.info(this.constants.EDITOR_MESSAGES?.RECORDING_STOPPED || 'Recording stopped');
        
        // Emit recording stopped event
        this.emitRecordingEvent('stopped', {
            totalKeyframes: this.keyframes.size,
            duration: this.videoDuration
        });
    }

    /**
     * Record a keyframe with selection data
     * @param {number} timestamp - Current video timestamp in seconds
     * @param {Object} selectionData - Selection position and properties
     */
    recordKeyframe(timestamp, selectionData) {
        if (!this.isRecording) return;
        
        // Ensure timestamp is within video bounds
        if (timestamp < 0 || timestamp > this.videoDuration) return;
        
        // Check if enough time has passed since last keyframe (for performance)
        const timeDiff = timestamp - this.lastKeyframeTime;
        const minInterval = this.constants.RECORDING?.KEYFRAME_INTERVAL / 1000 || 0.033; // Convert ms to seconds
        
        if (timeDiff < minInterval && this.keyframes.has(this.lastKeyframeTime)) return;
        
        // Create keyframe data
        const keyframe = {
            timestamp,
            selection: { ...selectionData },
            recordedAt: Date.now()
        };
        
        // Store keyframe
        this.keyframes.set(timestamp, keyframe);
        this.lastKeyframeTime = timestamp;
        this.currentTime = timestamp;
        
        this.utils.Logger.info(`Keyframe recorded at ${timestamp.toFixed(2)}s`);
        
        // Emit keyframe recorded event
        this.emitRecordingEvent('keyframe', keyframe);
    }

    /**
     * Update current time during playback
     * @param {number} timestamp - Current video timestamp
     */
    updateTime(timestamp) {
        this.currentTime = timestamp;
    }

    /**
     * Get keyframe data for specific timestamp
     * @param {number} timestamp - Timestamp to get keyframe for
     * @returns {Object|null} Keyframe data or null if not found
     */
    getKeyframeAt(timestamp) {
        return this.keyframes.get(timestamp) || null;
    }

    /**
     * Get interpolated selection data for timestamp
     * @param {number} timestamp - Current timestamp
     * @returns {Object|null} Interpolated selection data
     */
    getInterpolatedSelection(timestamp) {
        if (this.keyframes.size === 0) return null;
        
        // Get all timestamps
        const timestamps = Array.from(this.keyframes.keys()).sort((a, b) => a - b);
        
        // Find surrounding keyframes
        let beforeIndex = -1;
        let afterIndex = -1;
        
        for (let i = 0; i < timestamps.length; i++) {
            if (timestamps[i] <= timestamp) {
                beforeIndex = i;
            }
            if (timestamps[i] >= timestamp && afterIndex === -1) {
                afterIndex = i;
                break;
            }
        }
        
        // If exact match, return that keyframe
        if (beforeIndex === afterIndex && beforeIndex !== -1) {
            return this.keyframes.get(timestamps[beforeIndex]).selection;
        }
        
        // If no keyframes, return null
        if (beforeIndex === -1 && afterIndex === -1) return null;
        
        // If only after keyframe, return it
        if (beforeIndex === -1) {
            return this.keyframes.get(timestamps[afterIndex]).selection;
        }
        
        // If only before keyframe, return it
        if (afterIndex === -1) {
            return this.keyframes.get(timestamps[beforeIndex]).selection;
        }
        
        // Interpolate between keyframes
        return this.interpolateSelection(
            this.keyframes.get(timestamps[beforeIndex]).selection,
            this.keyframes.get(timestamps[afterIndex]).selection,
            timestamps[beforeIndex],
            timestamps[afterIndex],
            timestamp
        );
    }

    /**
     * Interpolate between two selection states
     * @param {Object} selection1 - First selection state
     * @param {Object} selection2 - Second selection state
     * @param {number} time1 - First timestamp
     * @param {number} time2 - Second timestamp
     * @param {number} currentTime - Current timestamp
     * @returns {Object} Interpolated selection
     */
    interpolateSelection(selection1, selection2, time1, time2, currentTime) {
        const progress = (currentTime - time1) / (time2 - time1);
        const easedProgress = this.constants.RECORDING?.SMOOTHING ? this.easeInOut(progress) : progress;
        
        return {
            x: this.lerp(selection1.x, selection2.x, easedProgress),
            y: this.lerp(selection1.y, selection2.y, easedProgress),
            width: this.lerp(selection1.width, selection2.width, easedProgress),
            height: this.lerp(selection1.height, selection2.height, easedProgress),
            zoom: this.lerp(selection1.zoom, selection2.zoom, easedProgress)
        };
    }

    /**
     * Linear interpolation
     * @param {number} start - Start value
     * @param {number} end - End value
     * @param {number} progress - Progress (0-1)
     * @returns {number} Interpolated value
     */
    lerp(start, end, progress) {
        return start + (end - start) * progress;
    }

    /**
     * Ease in-out function for smoother interpolation
     * @param {number} t - Time progress (0-1)
     * @returns {number} Eased progress
     */
    easeInOut(t) {
        return t < 0.5 ? 2 * t * t : -1 + (4 - 2 * t) * t;
    }

    /**
     * Delete keyframe at timestamp
     * @param {number} timestamp - Timestamp to delete
     */
    deleteKeyframe(timestamp) {
        if (this.keyframes.has(timestamp)) {
            this.keyframes.delete(timestamp);
            this.emitRecordingEvent('keyframeDeleted', { timestamp });
        }
    }

    /**
     * Clear all keyframes
     */
    clearKeyframes() {
        this.keyframes.clear();
        this.emitRecordingEvent('keyframesCleared');
    }

    /**
     * Export keyframes data for video generation
     * @param {number} startTime - Start time for export (optional)
     * @param {number} endTime - End time for export (optional)
     * @returns {Object} Export data
     */
    exportKeyframes(startTime = 0, endTime = this.videoDuration) {
        const filteredKeyframes = [];
        
        this.keyframes.forEach((keyframe, timestamp) => {
            if (timestamp >= startTime && timestamp <= endTime) {
                filteredKeyframes.push(keyframe);
            }
        });
        
        // Sort by timestamp
        filteredKeyframes.sort((a, b) => a.timestamp - b.timestamp);
        
        return {
            keyframes: filteredKeyframes,
            startTime,
            endTime,
            duration: endTime - startTime,
            totalKeyframes: filteredKeyframes.length,
            exportedAt: Date.now()
        };
    }

    /**
     * Import keyframes data
     * @param {Object} keyframesData - Previously exported keyframes data
     */
    importKeyframes(keyframesData) {
        this.clearKeyframes();
        
        if (keyframesData.keyframes) {
            keyframesData.keyframes.forEach(keyframe => {
                this.keyframes.set(keyframe.timestamp, keyframe);
            });
        }
        
        this.emitRecordingEvent('keyframesImported', {
            importedCount: keyframesData.keyframes?.length || 0
        });
    }

    /**
     * Get all keyframe timestamps
     * @returns {number[]} Array of timestamps
     */
    getKeyframeTimestamps() {
        return Array.from(this.keyframes.keys()).sort((a, b) => a - b);
    }

    /**
     * Get recording statistics
     * @returns {Object} Recording stats
     */
    getRecordingStats() {
        const timestamps = this.getKeyframeTimestamps();
        
        return {
            isRecording: this.isRecording,
            totalKeyframes: this.keyframes.size,
            currentTime: this.currentTime,
            videoDuration: this.videoDuration,
            firstKeyframe: timestamps[0] || null,
            lastKeyframe: timestamps[timestamps.length - 1] || null,
            averageInterval: this.getAverageKeyframeInterval()
        };
    }

    /**
     * Get average interval between keyframes
     * @returns {number} Average interval in seconds
     */
    getAverageKeyframeInterval() {
        const timestamps = this.getKeyframeTimestamps();
        if (timestamps.length < 2) return 0;
        
        const totalTime = timestamps[timestamps.length - 1] - timestamps[0];
        return totalTime / (timestamps.length - 1);
    }

    /**
     * Check if currently recording
     * @returns {boolean}
     */
    getRecordingStatus() {
        return this.isRecording;
    }

    /**
     * Emit recording-related events
     * @param {string} eventType - Event type
     * @param {Object} data - Event data
     */
    emitRecordingEvent(eventType, data = {}) {
        const event = new CustomEvent('frameRecorderEvent', {
            detail: {
                type: eventType,
                data,
                timestamp: Date.now()
            }
        });
        
        document.dispatchEvent(event);
    }

    /**
     * Cleanup resources
     */
    cleanup() {
        this.stopRecording();
        this.clearKeyframes();
    }
}

// Export for use in video editor
if (typeof window !== 'undefined') {
    window.FrameRecorder = FrameRecorder;
}