<template>
    <v-main>
        <EditTitleBar
            v-if="isEditMode === true"
            :title="selectedTitle"
            :isEditMode.sync="isEditMode"
            v-on:exit="onFinishEdit"
            v-on:selectall="onSelectAll"
            v-on:delete="onMultiplueDeletion"
        ></EditTitleBar>
        <TitleBar v-else :title="title">
            <template v-slot:menu>
                <ReservesMainMenu v-on:edit="onEdit" v-on:addCustomRecording="onAddCustomRecording"></ReservesMainMenu>
            </template>
        </TitleBar>
        <transition name="page">
            <div v-if="reservesState.getReserves().length > 0" ref="appContent" class="app-content pa-2">
                <div v-bind:style="contentWrapStyle">
                    <ReserveItems :reserves="reservesState.getReserves()" :isEditMode.sync="isEditMode" v-on:selected="selectItem"></ReserveItems>
                </div>
                <Pagination :total="reservesState.getTotal()" :pageSize="settingValue.reservesLength"></Pagination>
            </div>
        </transition>
        <div style="visibility: hidden">dummy</div>
        <ReserveMultipleDeletionDialog
            :isOpen.sync="isOpenMultiplueDeletionDialog"
            :total="reservesState.getSelectedCnt()"
            v-on:delete="onExecuteMultiplueDeletion"
        ></ReserveMultipleDeletionDialog>
        <v-dialog v-model="isOpenCustomRecordingDialog" max-width="640px">
            <v-card>
                <v-card-title>カスタム録画を追加</v-card-title>
                <v-card-text>
                    <v-text-field v-model="customRecordingChannelId" label="チャンネルID" type="number" required></v-text-field>
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
                    <v-btn color="primary" text v-on:click="onExecuteCustomRecording">追加</v-btn>
                </v-card-actions>
            </v-card>
        </v-dialog>
    </v-main>
</template>

<script lang="ts">
import Pagination from '@/components/pagination/Pagination.vue';
import ReserveItems from '@/components/reserves/ReserveItems.vue';
import ReserveMultipleDeletionDialog from '@/components/reserves/ReserveMultipleDeletionDialog.vue';
import ReservesMainMenu from '@/components/reserves/ReservesMainMenu.vue';
import Snackbar from '@/components/snackbar/Snackbar.vue';
import EditTitleBar from '@/components/titleBar/EditTitleBar.vue';
import TitleBar from '@/components/titleBar/TitleBar.vue';
import container from '@/model/ModelContainer';
import ISocketIOModel from '@/model/socketio/ISocketIOModel';
import IScrollPositionState from '@/model/state/IScrollPositionState';
import IReservesState from '@/model/state/reserve/IReservesState';
import ISnackbarState from '@/model/state/snackbar/ISnackbarState';
import { ISettingStorageModel, ISettingValue } from '@/model/storage/setting/ISettingStorageModel';
import Util from '@/util/Util';
import { Component, Vue, Watch } from 'vue-property-decorator';
import { Route } from 'vue-router';
import * as apid from '../../../api';

Component.registerHooks(['beforeRouteUpdate', 'beforeRouteLeave']);

@Component({
    components: {
        EditTitleBar,
        TitleBar,
        ReservesMainMenu,
        ReserveItems,
        Pagination,
        ReserveMultipleDeletionDialog,
    },
})
export default class Reserves extends Vue {
    public isEditMode: boolean = false;
    public isOpenMultiplueDeletionDialog: boolean = false;
    public isOpenCustomRecordingDialog: boolean = false;
    public customRecordingChannelId: string = '';
    public customRecordingName: string = '';
    public customRecordingMode: apid.CustomRecordingMode = 'duration';
    public customRecordingStartAt: string = '';
    public customRecordingEndAt: string = '';
    public customRecordingDurationMinutes: number = 30;
    public customRecordingModeItems = [
        { text: '録画時間を指定', value: 'duration' },
        { text: '終了日時を指定', value: 'time' },
        { text: '手動で停止するまで', value: 'manualStop' },
    ];

    private isVisibilityHidden: boolean = false;
    private reservesState: IReservesState = container.get<IReservesState>('IReservesState');
    private setting: ISettingStorageModel = container.get<ISettingStorageModel>('ISettingStorageModel');
    private settingValue: ISettingValue | null = null;
    private scrollState: IScrollPositionState = container.get<IScrollPositionState>('IScrollPositionState');
    private snackbarState: ISnackbarState = container.get<ISnackbarState>('ISnackbarState');
    private socketIoModel: ISocketIOModel = container.get<ISocketIOModel>('ISocketIOModel');
    private onUpdateStatusCallback = (async (): Promise<void> => {
        await this.reservesState.fetchData(this.createFetchDataOption());
    }).bind(this);

    get selectedTitle(): string {
        return `${this.reservesState.getSelectedCnt()} 件選択`;
    }

    /**
     * title
     */
    get title(): string {
        switch (this.$route.query.type) {
            case 'conflict':
                return '競合';
            case 'overlap':
                return '重複';
            case 'skip':
                return '除外';
            case 'normal':
            default:
                return '予約';
        }
    }

    get contentWrapStyle(): any {
        return this.isVisibilityHidden === false
            ? {}
            : {
                  opacity: 0,
                  visibility: 'hidden',
              };
    }

    public created(): void {
        this.settingValue = this.setting.getSavedValue();

        // socket.io イベント
        this.socketIoModel.onUpdateState(this.onUpdateStatusCallback);
    }

    public beforeDestroy(): void {
        // socket.io イベント
        this.socketIoModel.offUpdateState(this.onUpdateStatusCallback);
    }

    public beforeRouteUpdate(to: Route, from: Route, next: () => void): void {
        this.isVisibilityHidden = true;

        this.$nextTick(() => {
            next();
        });
    }

    public onEdit(): void {
        this.isEditMode = true;
    }

    public onAddCustomRecording(): void {
        const now = new Date();
        const startAt = new Date(now.getTime() + 5 * 60 * 1000);
        const endAt = new Date(startAt.getTime() + 30 * 60 * 1000);

        this.customRecordingName = '';
        this.customRecordingMode = 'duration';
        this.customRecordingStartAt = this.toDatetimeLocalValue(startAt);
        this.customRecordingEndAt = this.toDatetimeLocalValue(endAt);
        this.customRecordingDurationMinutes = 30;
        this.isOpenCustomRecordingDialog = true;
    }

    public async onExecuteCustomRecording(): Promise<void> {
        const channelId = parseInt(this.customRecordingChannelId, 10);

        if (Number.isNaN(channelId) === true) {
            this.snackbarState.open({
                color: 'error',
                text: 'チャンネルIDを入力してください。',
            });
            return;
        }

        try {
            const option: apid.CustomRecordingOption = {
                channelId: channelId,
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

            await this.reservesState.addCustomRecording(option);
            await this.reservesState.fetchData(this.createFetchDataOption());

            this.isOpenCustomRecordingDialog = false;
            this.snackbarState.open({
                color: 'success',
                text: 'カスタム録画予約を追加しました。',
            });
        } catch (err) {
            this.snackbarState.open({
                color: 'error',
                text: 'カスタム録画予約の追加に失敗しました。',
            });
            console.error(err);
        }
    }

    public onFinishEdit(): void {
        this.reservesState.clearSelect();
    }

    public onSelectAll(): void {
        this.reservesState.selectAll();
    }

    public selectItem(reserveId: apid.ReserveId): void {
        this.reservesState.select(reserveId);
    }

    public onMultiplueDeletion(): void {
        this.isOpenMultiplueDeletionDialog = true;
    }

    public async onExecuteMultiplueDeletion(): Promise<void> {
        this.isOpenMultiplueDeletionDialog = false;
        this.isEditMode = false;
        try {
            await this.reservesState.multiplueDeletion();
            this.snackbarState.open({
                color: 'success',
                text: '選択した番組の予約をキャンセルしました。',
            });
        } catch (err) {
            this.snackbarState.open({
                color: 'error',
                text: '一部番組のキャンセルに失敗しました。',
            });
        }
    }

    @Watch('$route', { immediate: true, deep: true })
    public onUrlChange(): void {
        this.reservesState.clearDate();
        this.$nextTick(async () => {
            await this.reservesState.fetchData(this.createFetchDataOption()).catch(err => {
                this.snackbarState.open({
                    color: 'error',
                    text: '予約データ取得に失敗',
                });
                console.error(err);
            });

            this.isVisibilityHidden = false;

            // データ取得完了を通知
            await this.scrollState.emitDoneGetData();
        });
    }

    /**
     * 予約データ取得時のオプションを生成する
     * @return GetReserveOption
     */
    private createFetchDataOption(): apid.GetReserveOption {
        if (this.settingValue === null) {
            throw new Error('SettingValueIsNull');
        }

        const type = this.$route.query.type;

        return {
            type: typeof type === 'undefined' ? 'all' : type === 'normal' || type === 'conflict' || type === 'overlap' || type === 'skip' ? type : 'normal',
            isHalfWidth: this.settingValue.isHalfWidthDisplayed,
            offset: (Util.getPageNum(this.$route) - 1) * this.settingValue.reservesLength,
            limit: this.settingValue.reservesLength,
        };
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
