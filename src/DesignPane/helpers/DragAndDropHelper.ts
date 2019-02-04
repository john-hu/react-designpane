export interface IDragAndDropHelper {
  isDraggable(node: any, index: number): boolean;
}

export const DefaultDnDHelper: IDragAndDropHelper = {
  isDraggable(_node: any, _index: number): boolean {
    return true;
  }
};
