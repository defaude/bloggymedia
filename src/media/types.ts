export type Orientation = 'landscape' | 'portrait';

export type SubtitleKind = 'text' | 'binary' | 'attachment' | 'data';

export type VideoStreamInfo = {
    index: number;
    width: number;
    height: number;
    codecName: string;
    frameRate: number;
};

export type AudioStreamInfo = {
    index: number;
    codecName: string;
    channels?: number;
    language?: string;
};

export type SubtitleStreamInfo = {
    index: number;
    codecName: string;
    kind: SubtitleKind;
    language?: string;
};

export type VideoProbe = {
    container?: string;
    video: VideoStreamInfo | null;
    audio: AudioStreamInfo[];
    subtitles: SubtitleStreamInfo[];
    hasMetadata: boolean;
};

export type TriggerReason = 'codec' | 'resolution' | 'frameRate' | 'metadata' | 'subtitleAttachment';

export type ProcessingPlan = {
    targetWidth: number;
    targetHeight: number;
    targetFrameRate: number;
    keepSubtitleIndices: number[];
    audioIndices: number[];
};

export type VideoInspectionDecision = {
    classification: 'skip' | 'process';
    reasons: TriggerReason[];
    plan: ProcessingPlan;
};

export type VideoInspectionResult = {
    filePath: string;
    fileName: string;
    probe: VideoProbe;
    orientation: Orientation;
    decision: VideoInspectionDecision;
};
