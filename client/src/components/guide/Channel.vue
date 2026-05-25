<template>
    <div>
        <div class="channels d-flex" v-bind:class="{ isDark: $vuetify.theme.dark === true }">
            <div class="item dummy">dummy</div>
            <div class="white--text item" v-for="channel in channelItems" v-bind:key="channel.index" v-on:click="onClick(channel.item)">
                {{ channel.name }}
            </div>
            <div class="item scrollbar">dummy</div>
        </div>

        <v-dialog v-model="isOpenChannelActionDialog" max-width="420px">
            <v-card>
                <v-card-title>{{ selectedChannelName }}</v-card-title>
                <v-card-text>このチャンネルで行う操作を選択してください。</v-card-text>
                <v-card-actions>
                    <v-spacer></v-spacer>
                    <v-btn text v-on:click="isOpenChannelActionDialog = false">キャンセル</v-btn>
                    <v-btn color="primary" text v-on:click="watchSelectedChannel">チャンネルを見る</v-btn>
                    <v-btn color="primary" text v-on:click="openCustomRecordingDialog">手動で録画</v-btn>
                </v-card-actions>
            </v-card>
        </v-dialog>

        <v-dialog v-model="isOpenCustomRecordingDialog" max-width="640px">
            <v-card>
                <v-card-title>手動で録画</v-card-title>
                <v-card-text>
                    <div class="subtitle-1 mb-2">{{ selectedChannelName }}</div>
                    <v-text-field v-model="customRecordingName" label="録画名" placeholder="未入力の場合は自動生成"></v-text-field>
                    <v-select v-model="customRecordingMode" :items="customRecordingModeItems" item-text="text" item-value="value" label="録画方法"></v-select>
                    <v-text-field v-model="customRecordingStartAt" label="開始日時" type="datetime-local"></v-text-field>
                    <v-text-field v-if="customRecordingMode === 'time'" v-model="customRecordingEndAt" label="終了日時" type="datetime-local"></v-text-field>
                    <v-text-field
                        v-if="customRecordingMode === 'duration'"
                        v-model.number="customRecordingDurationMinutes"
                        label="録画時間（分）"
                        type="number"
                        min="1"
                    ></v-text-field>
                    <div v-if="customRecordingMode === 'manualStop'" class="caption">手動停止モードでは、仮の終了時刻として開始日時から24時間後を設定します。</div>
                </v-card-text>
                <v-card-actions>
                    <v-spacer></v-spacer>
                    <v-btn text v-on:click="isOpenCustomRecordingDialog = false">キャンセル</v-btn>
                    <v-btn color="primary" text v-on:click="addCustomRecording">追加</v-btn>
                </v-card-actions>
            </v-card>
        </v-dialog>
    </div>
</template>

<script lang="ts">
import container from '@/model/ModelContainer';
import IGuideState from '@/model/state/guide/IGuideState';
import IOnAirSelectStreamState from '@/model/state/onair/IOnAirSelectStreamState';
import DateUtil from '@/util/DateUtil';
import Util from '@/util/Util';
import { Component, Vue } from 'vue-property-decorator';
import * as apid from '../../../../api';

interface DisplayChannelItem {
    name: string;
    id: apid.ChannelId;
    index: number | string;
    item: apid.ScheduleChannleItem;
}

@Component({})
export default class Channel extends Vue {
    public guideState: IGuideState = container.get<IGuideState>('IGuideState');

    private streamSelectDialog: IOnAirSelectStreamState = container.get<IOnAirSelectStreamState>('IOnAirSelectStreamState');

    public isOpenChannelActionDialog: boolean = false;
    public isOpenCustomRecordingDialog: boolean = false;
    public selectedChannel: apid.ScheduleChannleItem | null = null;
    public customRecordingName: string = '';
    public customRecordingMode: apid.CustomRecordingMode = 'duration';
    public customRecordingStartAt: string = '';
    public customRecordingEndAt: string = '';
    public customRecordingDurationMinutes: number = 30;
    public customRecordingModeItems: { text: string; value: apid.CustomRecordingMode }[] = [
        { text: '録画時間を指定', value: 'duration' },
        { text: '終了日時を指定', value: 'time' },
        { text: '手動で停止するまで', value: 'manualStop' },
    ];

    get selectedChannelName(): string {
        return this.selectedChannel === null ? 'チャンネル' : this.selectedChannel.name;
    }

    get channelItems(): DisplayChannelItem[] {
        if (typeof this.$route.query.channelId === 'undefined') {
            return this.guideState.getChannels().map(c => {
                return {
                    name: c.name,
                    id: c.id,
                    index: c.id,
                    item: c,
                };
            });
        } else {
            let baseTime = this.guideState.getStartAt();

            return this.guideState.getChannels().map(c => {
                const name = DateUtil.format(DateUtil.getJaDate(new Date(baseTime)), 'MM/dd(w)');
                baseTime += 60 * 60 * 24 * 1000;

                return {
                    name: name,
                    id: c.id,
                    index: name,
                    item: c,
                };
            });
        }
    }

    public async onClick(item: apid.ScheduleChannleItem): Promise<void> {
        // 単局表示の場合は何もしない
        if (typeof this.$route.query.channelId !== 'undefined') {
            return;
        }

        this.selectedChannel = item;
        this.isOpenChannelActionDialog = true;
    }

    public watchSelectedChannel(): void {
        if (this.selectedChannel === null) {
            return;
        }

        this.isOpenChannelActionDialog = false;
        this.streamSelectDialog.open(this.selectedChannel);
    }

    public openCustomRecordingDialog(): void {
        const now = new Date();
        const startAt = new Date(now.getTime() + 5 * 60 * 1000);
        const endAt = new Date(startAt.getTime() + 30 * 60 * 1000);

        this.isOpenChannelActionDialog = false;
        this.customRecordingName = '';
        this.customRecordingMode = 'duration';
        this.customRecordingStartAt = this.toDatetimeLocalValue(startAt);
        this.customRecordingEndAt = this.toDatetimeLocalValue(endAt);
        this.customRecordingDurationMinutes = 30;
        this.isOpenCustomRecordingDialog = true;
    }

    public async addCustomRecording(): Promise<void> {
        if (this.selectedChannel === null) {
            return;
        }

        try {
            const option: apid.CustomRecordingOption = {
                channelId: this.selectedChannel.id,
                startAt: this.parseDatetimeLocalValue(this.customRecordingStartAt),
                mode: this.customRecordingMode,
            };

            if (this.customRecordingName.length > 0) {
                option.name = this.customRecordingName;
            }

            if (this.customRecordingMode === 'time') {
                option.endAt = this.parseDatetimeLocalValue(this.customRecordingEndAt);
            } else if (this.customRecordingMode === 'duration') {
                option.durationMinutes = this.customRecordingDurationMinutes;
            }

            const response = await fetch('./api/custom-recording', {
                method: 'POST',
                headers: {
                    'Content-Type': 'application/json',
                },
                body: JSON.stringify(option),
            });

            if (response.ok === false) {
                throw new Error('AddCustomRecordingError');
            }

            this.isOpenCustomRecordingDialog = false;
            Util.sleep(0).then(() => {
                window.alert('カスタム録画予約を追加しました。');
            });
        } catch (err) {
            console.error(err);
            window.alert('カスタム録画予約の追加に失敗しました。');
        }
    }

    private toDatetimeLocalValue(date: Date): string {
        const year = date.getFullYear().toString(10).padStart(4, '0');
        const month = (date.getMonth() + 1).toString(10).padStart(2, '0');
        const day = date.getDate().toString(10).padStart(2, '0');
        const hour = date.getHours().toString(10).padStart(2, '0');
        const minute = date.getMinutes().toString(10).padStart(2, '0');

        return `${year}-${month}-${day}T${hour}:${minute}`;
    }

    private parseDatetimeLocalValue(value: string): apid.UnixtimeMS {
        const time = new Date(value).getTime();

        if (Number.isNaN(time) === true) {
            throw new Error('InvalidDateTime');
        }

        return time;
    }
}
</script>

<style lang="sass" scoped>
$board-line: 1px solid #ccc
$board-line-dark: 1px solid #888888

.channels
    .item
        min-width: var(--channel-width)
        max-width: var(--channel-width)
        width: var(--channel-width)
        min-height: var(--channel-height)
        max-height: var(--channel-height)
        height: var(--channel-height)
        font-size: var(--channel-fontsize)
        font-weight: bold
        cursor: pointer
        overflow: hidden
        white-space: nowrap
        display: flex
        justify-content: center
        align-items: center
        background: #999
        box-sizing: border-box
        border-left: $board-line
        border-right: $board-line

    .item.dummy
        min-width: var(--timescale-width)
        max-width: var(--timescale-width)
        width: var(--timescale-width)
        visibility: hidden

    .item.scrollbar
        visibility: hidden

    &.isDark
        .item
            background: #393e46
            border-left: $board-line-dark
            border-right: $board-line-dark
</style>
