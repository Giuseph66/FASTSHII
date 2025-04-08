import type { TurboModule } from 'react-native';
import type { Double, Int32, UnsafeObject } from 'react-native/Libraries/Types/CodegenTypes';
type CaptureData = {
    uri: string;
    name: string;
    height: Int32;
    width: Int32;
    id?: string;
    path?: string;
    size?: Int32;
};
export interface Spec extends TurboModule {
    capture(options?: UnsafeObject, tag?: Double): Promise<CaptureData>;
    requestDeviceCameraAuthorization: () => Promise<boolean>;
    checkDeviceCameraAuthorizationStatus: () => Promise<boolean>;
}
declare const _default: Spec;
export default _default;
