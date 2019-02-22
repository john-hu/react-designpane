import * as React from 'react';
import * as ReactDOM from 'react-dom';

export type ReactInfo = {
  container: React.ReactInstance;
  // the ReactNode of the instance.
  node: React.ReactNode;
  instance: React.ReactInstance;
};
export type HTMLTarget = {
  container: HTMLElement;
  target: HTMLElement;
  pageOffset: {
    x: number;
    y: number;
  };
};

/**
 * The purpose of LayoutHelper:
 * 1. check if an element can be a container for receiving the dragging component
 * 2. calculate the layout hint by layout. currently, the layout hint is the insert position.
 */
export interface ILayoutHelper {
  /** determine if the instance can be dropped into container */
  canDrop(reactInfo: ReactInfo): boolean;
  /**
   * try to layout the UI to display the ghost image at the correct position
   * @returns anything which will be passed to onLayoutChange callback as the layoutHint
   */
  layout(reactInfo: ReactInfo, layoutTarget: HTMLTarget, x: number, y: number): any;
}

export class FlowLayoutHelper implements ILayoutHelper {
  canDrop(_reactInfo: ReactInfo): boolean {
    return true;
  }

  layout(reactInfo: ReactInfo, layoutTarget: HTMLTarget, x: number, y: number): any {
    const { instance } = reactInfo;
    const { container, target, pageOffset } = layoutTarget;
    const instanceNode: Element = ReactDOM.findDOMNode(instance) as Element;
    // the position relative to the DesignPane container
    const translatedX = x - pageOffset.x;
    const translatedY = y - pageOffset.y;
    let before: Element | null = null;
    let check: Element | null = container.firstElementChild;
    let beforeIndex: number = 0;
    while (check && !before) {
      const { top, left, bottom, right } = check.getBoundingClientRect();
      // container center position relative to the DesignPane container
      const centerV = (top + bottom) / 2 - pageOffset.y;
      const centerH = (left + right) / 2 - pageOffset.x;
      const translatedBottom = bottom - pageOffset.y;
      if (translatedY < centerV && translatedX < centerH) {
        before = check;
      } else if (translatedY < translatedBottom && translatedX < centerH) {
        before = check;
      } else if (check === instanceNode) {
        check = check.nextElementSibling;
        // we don't need to increase beforeIndex because it is the dragging node and should be
        // removed during layout.
      } else {
        check = check.nextElementSibling;
        beforeIndex++;
      }
    }

    container.insertBefore(target, before);
    return beforeIndex;
  }
}
