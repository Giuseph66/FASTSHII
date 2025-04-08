/// <reference types="react-native/types/modules/codegen" />
import type { ViewProps, ColorValue } from 'react-native';
import type { DirectEventHandler, Int32, Double } from 'react-native/Libraries/Types/CodegenTypes';
type OnReadCodeData = {
    codeStringValue: string;
    codeFormat: string;
};
type OnOrientationChangeData = {
    orientation: Int32;
};
type OnZoom = {
    zoom: Double;
};
export interface NativeProps extends ViewProps {
    flashMode?: string;
    focusMode?: string;
    zoomMode?: string;
    zoom?: Double;
    maxZoom?: Double;
    torchMode?: string;
    cameraType?: string;
    onOrientationChange?: DirectEventHandler<OnOrientationChangeData>;
    onZoom?: DirectEventHandler<OnZoom>;
    onError?: DirectEventHandler<{
        errorMessage: string;
    }>;
    scanBarcode?: boolean;
    showFrame?: boolean;
    laserColor?: ColorValue;
    frameColor?: ColorValue;
    onReadCode?: DirectEventHandler<OnReadCodeData>;
    ratioOverlay?: string;
    ratioOverlayColor?: ColorValue;
    resetFocusTimeout?: Int32;
    resetFocusWhenMotionDetected?: boolean;
    resizeMode?: string;
    scanThrottleDelay?: Int32;
    shutterPhotoSound?: boolean;
    onCaptureButtonPressIn?: DirectEventHandler<{}>;
    onCaptureButtonPressOut?: DirectEventHandler<{}>;
    shutterAnimationDuration?: Int32;
    outputPath?: string;
    onPictureTaken?: DirectEventHandler<{
        uri: string;
    }>;
}
declare const _default: import("react-native/Libraries/Utilities/codegenNativeComponent").NativeComponentType<NativeProps>;
export default _default;
