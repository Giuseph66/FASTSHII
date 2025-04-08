import { type ViewProps } from 'react-native';
import { CameraType, type FlashMode, type FocusMode, type ZoomMode, type TorchMode, type ResizeMode, type CodeFormat } from './types';
import { Orientation } from './index';
export type OnReadCodeData = {
    nativeEvent: {
        codeStringValue: string;
        codeFormat: CodeFormat;
    };
};
export type OnOrientationChangeData = {
    nativeEvent: {
        orientation: typeof Orientation[keyof typeof Orientation];
    };
};
export type OnZoom = {
    nativeEvent: {
        zoom: number;
    };
};
export interface CameraProps extends ViewProps {
    flashMode?: FlashMode;
    focusMode?: FocusMode;
    zoomMode?: ZoomMode;
    zoom?: number;
    maxZoom?: number;
    torchMode?: TorchMode;
    cameraType?: CameraType;
    onOrientationChange?: (event: OnOrientationChangeData) => void;
    onZoom?: (event: OnZoom) => void;
    onError?: (event: {
        nativeEvent: {
            errorMessage: string;
        };
    }) => void;
    scanBarcode?: boolean;
    showFrame?: boolean;
    laserColor?: number | string;
    frameColor?: number | string;
    onReadCode?: (event: OnReadCodeData) => void;
    ratioOverlay?: string;
    ratioOverlayColor?: number | string;
    resetFocusTimeout?: number;
    resetFocusWhenMotionDetected?: boolean;
    resizeMode?: ResizeMode;
    scanThrottleDelay?: number;
    maxPhotoQualityPrioritization?: 'balanced' | 'quality' | 'speed';
    shutterPhotoSound?: boolean;
    onCaptureButtonPressIn?: ({ nativeEvent: {} }: {
        nativeEvent: {};
    }) => void;
    onCaptureButtonPressOut?: ({ nativeEvent: {} }: {
        nativeEvent: {};
    }) => void;
}
