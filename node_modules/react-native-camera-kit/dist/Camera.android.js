import React from 'react';
import { findNodeHandle, processColor } from 'react-native';
import NativeCamera from './specs/CameraNativeComponent';
import NativeCameraKitModule from './specs/NativeCameraKitModule';
const Camera = React.forwardRef((props, ref) => {
    const nativeRef = React.useRef(null);
    React.useImperativeHandle(ref, () => ({
        capture: async (options = {}) => {
            return await NativeCameraKitModule.capture(options, findNodeHandle(nativeRef.current) ?? undefined);
        },
        requestDeviceCameraAuthorization: () => {
            throw new Error('Not implemented');
        },
        checkDeviceCameraAuthorizationStatus: () => {
            throw new Error('Not implemented');
        },
    }));
    const transformedProps = { ...props };
    transformedProps.ratioOverlayColor = processColor(props.ratioOverlayColor);
    transformedProps.frameColor = processColor(props.frameColor);
    transformedProps.laserColor = processColor(props.laserColor);
    return <NativeCamera style={{ minWidth: 100, minHeight: 100 }} ref={nativeRef} {...transformedProps}/>;
});
export default Camera;
//# sourceMappingURL=Camera.android.js.map