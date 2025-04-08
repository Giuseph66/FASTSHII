import React from 'react';
import { findNodeHandle } from 'react-native';
import NativeCamera from './specs/CameraNativeComponent';
import NativeCameraKitModule from './specs/NativeCameraKitModule';
const Camera = React.forwardRef((props, ref) => {
    const nativeRef = React.useRef(null);
    props.resetFocusTimeout = props.resetFocusTimeout ?? 0;
    props.resetFocusWhenMotionDetected = props.resetFocusWhenMotionDetected ?? true;
    React.useImperativeHandle(ref, () => ({
        capture: async () => {
            return await NativeCameraKitModule.capture({}, findNodeHandle(nativeRef.current) ?? undefined);
        },
        requestDeviceCameraAuthorization: async () => {
            return await NativeCameraKitModule.checkDeviceCameraAuthorizationStatus();
        },
        checkDeviceCameraAuthorizationStatus: async () => {
            return await NativeCameraKitModule.checkDeviceCameraAuthorizationStatus();
        },
    }));
    return <NativeCamera style={{ minWidth: 100, minHeight: 100 }} ref={nativeRef} {...props}/>;
});
export default Camera;
//# sourceMappingURL=Camera.ios.js.map