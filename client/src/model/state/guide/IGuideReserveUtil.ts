import * as apid from '../../../../../api';

export type ReserveType = 'none' | 'reserve' | 'conflict' | 'skip' | 'overlap';

export interface ReserveStateItem {
    type: ReserveType;
    item: apid.ReserveListItem;
}

export type ReserveStateItemIndex = { [programId: number]: ReserveStateItem };

export interface CustomReserveStateItem {
    item: apid.ReserveItem;
}

export default interface IGuideReserveUtil {
    getReserveIndex(option: apid.GetReserveListsOption): Promise<ReserveStateItemIndex>;
    getCustomReserveItems(option: apid.GetReserveListsOption): Promise<CustomReserveStateItem[]>;
}
