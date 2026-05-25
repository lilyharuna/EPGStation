import { Operation } from 'express-openapi';

import IRecordingApiModel from '../../../../api/recording/IRecordingApiModel';

import container from '../../../../ModelContainer';

import * as api from '../../../api';

export const post: Operation = async (req, res) => {
    const recordingApiModel = container.get<IRecordingApiModel>('IRecordingApiModel');

    try {
        await recordingApiModel.stopRecording(parseInt(req.params.reserveId, 10));

        api.responseJSON(res, 200, {
            code: 200,

            message: 'ok',
        });
    } catch (err: any) {
        api.responseServerError(res, err.message);
    }
};

post.apiDoc = {
    summary: '録画停止',

    tags: ['recording'],

    description: '録画中のファイルを削除せずに録画を停止する',

    parameters: [
        {
            $ref: '#/components/parameters/PathReserveId',
        },
    ],

    responses: {
        200: {
            description: '録画を停止しました',
        },

        default: {
            description: '予期しないエラー',

            content: {
                'application/json': {
                    schema: {
                        $ref: '#/components/schemas/Error',
                    },
                },
            },
        },
    },
};
