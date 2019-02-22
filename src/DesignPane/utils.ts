export type Rect = {
  x: number;
  y: number;
  width: number;
  height: number;
};

export type Offset = {
  x: number;
  y: number;
};

export const getChildOffset = (container: HTMLElement): Offset => {
  const containerRect: ClientRect = container.getBoundingClientRect();
  return {
    x: containerRect.left + container.clientLeft,
    y: containerRect.top + container.clientTop
  };
};

export const getPageOffset = (decendent: HTMLElement, pageContainer: HTMLElement): Offset => {
  const offset: Offset = getChildOffset(decendent);
  let target: HTMLElement | null = decendent.parentElement;
  while (target && target !== pageContainer) {
    const parentOffset = getChildOffset(target);
    offset.x += parentOffset.x;
    offset.y += parentOffset.y;
    target = target.parentElement;
  }
  return offset;
};

export const calcPosition = (container: HTMLElement, directChild: HTMLElement): Rect => {
  const targetRect: ClientRect = directChild.getBoundingClientRect();
  const containerOffset: Offset = getChildOffset(container);
  return {
    x: targetRect.left - containerOffset.x,
    y: targetRect.top - containerOffset.y,
    width: targetRect.width,
    height: targetRect.height
  };
};
