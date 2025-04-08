import Camera from './Camera';
import { CameraType, type CameraApi, type CaptureData, type FlashMode, type FocusMode, type TorchMode, type ZoomMode, type ResizeMode } from './types';
declare const CameraKit: any;
export declare const Orientation: {
    PORTRAIT: number;
    LANDSCAPE_LEFT: number;
    PORTRAIT_UPSIDE_DOWN: number;
    LANDSCAPE_RIGHT: number;
};
export default CameraKit;
export { Camera, CameraType };
export type { TorchMode, FlashMode, FocusMode, ZoomMode, CameraApi, CaptureData, ResizeMode };
