import * as apid from '../../../../api';

export default interface IRecordingApiModel {
    gets(option: apid.GetRecordedOption): Promise<apid.Records>;
    resetTimer(): Promise<void>;
    stopRecording(reserveId: apid.ReserveId): Promise<void>;
}
