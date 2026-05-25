import { Operation } from 'express-openapi';
import * as apid from '../../../../api';
import IReserveApiModel from '../../api/reserve/IReserveApiModel';
import container from '../../ModelContainer';
import * as api from '../api';

interface CustomRecordingOption {
    channelId: apid.ChannelId;
    startAt?: apid.UnixtimeMS;
    endAt?: apid.UnixtimeMS;
    durationMinutes?: number;
    mode?: 'time' | 'duration' | 'manualStop';
    name?: string;
}

const CUSTOM_RECORDING_SUFFIX = ' [カスタム録画]';
const MANUAL_STOP_DURATION_MS = 24 * 60 * 60 * 1000;

const addCustomRecordingSuffix = (name: string): string => {
    if (name.endsWith(CUSTOM_RECORDING_SUFFIX)) {
        return name;
    }

    return `${name}${CUSTOM_RECORDING_SUFFIX}`;
};

export const post: Operation = async (req, res) => {
    const reserveApiModel = container.get<IReserveApiModel>('IReserveApiModel');

    try {
        const option = req.body as CustomRecordingOption;
        const now = new Date().getTime();

        if (typeof option.channelId === 'undefined') {
            throw new Error('ChannelIdIsUndefined');
        }

        const startAt = typeof option.startAt === 'undefined' ? now : option.startAt;
        let endAt: number;

        if (option.mode === 'manualStop') {
            endAt = startAt + MANUAL_STOP_DURATION_MS;
        } else if (typeof option.durationMinutes !== 'undefined') {
            endAt = startAt + option.durationMinutes * 60 * 1000;
        } else if (typeof option.endAt !== 'undefined') {
            endAt = option.endAt;
        } else {
            throw new Error('EndAtOrDurationMinutesIsUndefined');
        }

        if (endAt <= startAt) {
            throw new Error('InvalidRecordingTime');
        }

        const baseName =
            typeof option.name === 'undefined' || option.name.length === 0
                ? `Custom Recording ${new Date(startAt).toISOString()}`
                : option.name;

        const reserveOption: apid.ManualReserveOption = {
            allowEndLack: false,
            timeSpecifiedOption: {
                channelId: option.channelId,
                startAt: startAt,
                endAt: endAt,
                name: addCustomRecordingSuffix(baseName),
            },
        };

        api.responseJSON(res, 201, {
            reserveId: await reserveApiModel.add(reserveOption),
        });
    } catch (err: any) {
        api.responseServerError(res, err.message);
    }
};

post.apiDoc = {
    summary: 'カスタム録画追加',
    tags: ['reserves'],
    description: 'チャンネルと時刻を指定してカスタム録画予約を追加する',
    requestBody: {
        content: {
            'application/json': {
                schema: {
                    type: 'object',
                    required: ['channelId'],
                    properties: {
                        channelId: {
                            type: 'integer',
                        },
                        startAt: {
                            type: 'integer',
                        },
                        endAt: {
                            type: 'integer',
                        },
                        durationMinutes: {
                            type: 'integer',
                        },
                        mode: {
                            type: 'string',
                            enum: ['time', 'duration', 'manualStop'],
                        },
                        name: {
                            type: 'string',
                        },
                    },
                },
            },
        },
        required: true,
    },
    responses: {
        201: {
            description: 'カスタム録画予約の追加に成功した',
            content: {
                'application/json': {
                    schema: {
                        $ref: '#/components/schemas/AddedReserve',
                    },
                },
            },
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
