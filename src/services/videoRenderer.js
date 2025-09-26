/**
 * Video Renderer Service
 * Handles video rendering using FFmpeg.wasm
 */
class VideoRenderer {
    constructor() {
        this.ffmpeg = null;
        this.isLoaded = false;
        this.utils = window.TWITCH_CLIP_EDITOR_UTILS;
        this.constants = window.EDITOR_CONSTANTS;
    }

    /**
     * Load the FFmpeg library.
     * Must be called before any rendering.
     */
    async load() {
        if (this.isLoaded) return;

        this.utils.Logger.info('Loading FFmpeg.wasm library...');
        // In a Chrome Extension, we must load it from a web_accessible_resource
        const corePath = chrome.runtime.getURL('src/libs/ffmpeg/ffmpeg-core.js');
        
        // This is a workaround because dynamic import is tricky in content scripts.
        // We'll inject a script tag to load it into the page's context.
        await new Promise((resolve, reject) => {
            const script = document.createElement('script');
            script.src = corePath;
            script.onload = resolve;
            script.onerror = reject;
            document.head.appendChild(script);
        });

        if (window.FFmpeg) {
            this.ffmpeg = window.FFmpeg.createFFmpeg({
                log: true, // Enable FFmpeg logging for debugging
                corePath: chrome.runtime.getURL('src/libs/ffmpeg/ffmpeg-core.wasm'),
            });
            await this.ffmpeg.load();
            this.isLoaded = true;
            this.utils.Logger.info('FFmpeg.wasm library loaded successfully.');
        } else {
            throw new Error('FFmpeg core script did not load correctly.');
        }
    }

    /**
     * Render the video with keyframe data.
     * @param {File} videoFile - The source video file.
     * @param {Array} keyframes - The array of keyframe data.
     * @param {Function} onProgress - Callback for rendering progress.
     * @returns {File} The rendered video file.
     */
    async render(videoFile, keyframes, onProgress, trimStart, trimEnd) {
        if (!this.isLoaded) throw new Error('FFmpeg is not loaded. Call load() first.');
        if (!keyframes || keyframes.length === 0) throw new Error('No keyframes provided for rendering.');

        this.utils.Logger.info('Starting advanced video render process...');
        onProgress({ message: 'Preparing video data...' });

        const inputFileName = 'input.mp4';
        const outputFileName = 'output.mp4';

        this.ffmpeg.FS('writeFile', inputFileName, await window.FFmpeg.fetchFile(videoFile));

        // --- Build the complex filtergraph from keyframes ---
        const videoMetadata = { width: 1920, height: 1080 }; // Assuming 1080p, should be dynamic later
        const targetAspect = 9 / 16;

        // Filter to trim the video first
        const trimFilter = `trim=start=${trimStart}:end=${trimEnd},setpts=PTS-STARTPTS`;

        // Build the zoompan filter expressions
        let zExpr = "'1'"; // Default zoom
        let xExpr = "'iw/2-(iw*1)/2'"; // Default x
        let yExpr = "'ih/2-(ih*1)/2'"; // Default y

        if (keyframes && keyframes.length > 0) {
            // Normalize keyframe timestamps relative to the trim start
            const relativeKeyframes = keyframes.map(kf => ({
                ...kf,
                timestamp: kf.timestamp - trimStart
            }));

            zExpr = `'${relativeKeyframes.map(kf => `if(gte(t,${kf.timestamp}),${kf.selection.zoom},1)`).join(':')}'`;
            xExpr = `'${relativeKeyframes.map(kf => `if(gte(t,${kf.timestamp}),${kf.selection.x},iw/2)`).join(':')}'`;
            yExpr = `'${relativeKeyframes.map(kf => `if(gte(t,${kf.timestamp}),${kf.selection.y},ih/2)`).join(':')}'`;
        }
        
        const zoompanFilter = `zoompan=z=${zExpr}:x=${xExpr}:y=${yExpr}:d=-1:s=${this.constants.CANVAS.PREVIEW_WIDTH}x${this.constants.CANVAS.PREVIEW_HEIGHT}:fps=30`;
        const cropFilter = `crop=w=ih*${targetAspect}`;
        const formatFilter = `format=yuv420p`;

        const filtergraph = `${trimFilter},${cropFilter},${zoompanFilter},${formatFilter}`;

        const command = [
            '-i', inputFileName,
            '-vf', filtergraph,
            '-c:v', 'libx264',
            '-preset', 'veryfast',
            '-crf', '22',
            outputFileName
        ];

        this.utils.Logger.info('Executing FFmpeg command:', command.join(' '));
        onProgress({ message: 'Rendering video... (this may take a while)' });

        this.ffmpeg.setProgress(({ ratio }) => {
            onProgress({ ratio: Math.max(0, ratio) });
        });

        await this.ffmpeg.run(...command);

        onProgress({ message: 'Finalizing video...' });

        const data = this.ffmpeg.FS('readFile', outputFileName);
        const renderedFile = new File([data.buffer], `fastclipper-export-${Date.now()}.mp4`, { type: 'video/mp4' });
        
        this.utils.Logger.info('Video rendering complete.');
        return renderedFile;
    }

    /**
     * Cleanup FFmpeg instance.
     */
    cleanup() {
        if (this.ffmpeg && this.isLoaded) {
            try {
                this.ffmpeg.exit();
            } catch (e) {
                // FFmpeg might throw an error on exit, which is often safe to ignore.
            }
        }
        this.ffmpeg = null;
        this.isLoaded = false;
    }
}

if (typeof window !== 'undefined') {
    window.VideoRenderer = VideoRenderer;
}
