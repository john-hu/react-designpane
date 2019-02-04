import * as React from 'react';
import { Rect } from './utils';

export interface IRectTrackerProps extends Rect {
  draggable?: boolean;
  visible:boolean;
  onDragStart?(evt: any): void;
}

export class RectTracker extends React.PureComponent<IRectTrackerProps, {}> {
  static baseStyle: React.CSSProperties = {
    backgroundColor: 'transparent',
    outlineColor: '#ffe564',
    outlineStyle: 'solid',
    outlineWidth: '2px',
    transitionProperty: 'left, top, width, height',
    transitionDuration: '0.1s',
    transitionTimingFunction: 'ease-in-out'
  };

  render() {
    const { x, y, width, height, draggable, visible, onDragStart } = this.props;
    const style: React.CSSProperties = {
      ...(visible ? RectTracker.baseStyle : {}),
      height,
      left: x,
      position: 'absolute',
      top: y,
      width,
    };

    return <div style={style} draggable={draggable} onDragStart={onDragStart} />;
  }
}
