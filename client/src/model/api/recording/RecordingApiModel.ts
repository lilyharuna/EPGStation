import { inject, injectable } from 'inversify';
import * as apid from '../../../../../api';
import IRepositoryModel from '../IRepositoryModel';
import IRecordingApiModel from './IRecordingApiModel';

@injectable()
export default class RecordingApiModel implements IRecordingApiModel {
    private repository: IRepositoryModel;

    constructor(@inject('IRepositoryModel') repository: IRepositoryModel) {
        this.repository = repository;
    }

    /**
     * 録画情報の取得
     * @param option: GetRecordedOption
     * @return Promise<apid.Records>
     */
    public async gets(option: apid.GetRecordedOption): Promise<apid.Records> {
        const result = await this.repository.get('/recording', {
            params: option,
        });

        return result.data;
    }

    /**
     * 録画ファイルを削除せずに録画を停止する
     * @param reserveId: ReserveId
     */
    public async stopRecording(reserveId: apid.ReserveId): Promise<void> {
        await this.repository.post(`/recording/${reserveId}/stop`);
    }
}
