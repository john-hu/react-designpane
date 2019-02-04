import * as React from 'react';
import * as ReactDOM from 'react-dom';
import { RectTracker } from './RectTracker';
import { IDragAndDropHelper, DefaultDnDHelper } from './helpers/DragAndDropHelper';
import { ILayoutHelper, FlowLayoutHelper } from './helpers/LayoutHelper';
import { Rect, calcPosition, getChildOffset } from './utils';

export interface IDesignPaneProps extends React.ComponentProps<'section'> {
  dndHelper?: IDragAndDropHelper;

  onLayoutChange?(node: any, layoutHint: any): void;
  onStartDragging?(node: any): void;
}
interface IDesignPaneState {
  draggingTarget: {
    instance: React.ReactInstance;
    node: React.ReactNode;
    ghost: HTMLElement;
  } | null;
  focusedKey: string | null;
  rectTrackerInfo: Rect | null | undefined;
}

export default class DesignPane extends React.PureComponent<IDesignPaneProps, IDesignPaneState> {
  static style: React.CSSProperties = {
    position: 'absolute'
  };
  layoutHint: any;
  // refs
  mainContainer: React.RefObject<HTMLElement>;
  rectTracker: React.RefObject<RectTracker>;
  // wrapper info
  wrappedChildren: { [key: string]: React.ReactInstance } = {};
  wrappedNodeList: {
    [key: string]: {
      node: React.ReactNode;
      index: number;
    };
  } = {};
  layoutHelper: ILayoutHelper = new FlowLayoutHelper();

  constructor(props: IDesignPaneProps) {
    super(props);
    this.state = {
      draggingTarget: null,
      focusedKey: null,
      rectTrackerInfo: null
    };
    this.mainContainer = React.createRef();
    this.rectTracker = React.createRef();
  }

  bindChildren(index: string, ref: React.ReactInstance) {
    this.wrappedChildren[index] = ref;
  }

  isRectTrackerEvent = (evt: Event): boolean => {
    if (!this.rectTracker.current) {
      return false;
    }
    const rect = ReactDOM.findDOMNode(this.rectTracker.current) as HTMLElement;
    return rect.contains(evt.target as Node);
  };

  resetDraggingTarget = (): void => {
    const { draggingTarget } = this.state;
    if (!draggingTarget || !this.mainContainer.current) {
      return;
    }
    const { instance, ghost } = draggingTarget;
    const targetNode: HTMLElement = ReactDOM.findDOMNode(instance) as HTMLElement;
    targetNode.style.display = null;
    ghost.parentNode && ghost.parentNode.removeChild(ghost);
    this.setState({
      draggingTarget: null,
      focusedKey: null,
      rectTrackerInfo: null
    });
  };

  handleMouseLeaveUp = (evt: React.SyntheticEvent) => {
    // This event belongs to RectTracker. No need to process it.
    if (this.isRectTrackerEvent(evt.nativeEvent)) {
      return;
    }
    this.resetDraggingTarget();
  };

  handleMouseDown = (evt: React.SyntheticEvent) => {
    // This event belongs to RectTracker. No need to process it.
    if (this.isRectTrackerEvent(evt.nativeEvent)) {
      return;
    }
    let targetElement: HTMLElement | null = null;
    let targetKey: string | null = null;
    // iterate all children to check which one contains the event target.
    for (let key in this.wrappedChildren) {
      const wrapper: HTMLElement = ReactDOM.findDOMNode(this.wrappedChildren[key]) as HTMLElement;
      const isTarget = wrapper.contains(evt.nativeEvent.target as Node);
      if (isTarget) {
        targetElement = wrapper;
        targetKey = key;
        break;
      }
    }
    // if we found it, we should save it.
    if (targetElement && this.mainContainer.current) {
      this.setState({
        draggingTarget: null,
        focusedKey: targetKey,
        rectTrackerInfo: calcPosition(this.mainContainer.current, targetElement)
      });
      evt.stopPropagation();
      evt.preventDefault();
    }
  };

  handleDragStarted = (
    reactNode: any,
    key: string,
    evt: React.SyntheticEvent<Element, DragEvent>
  ): void => {
    const { onStartDragging } = this.props;
    const { rectTrackerInfo } = this.state;
    const draggingTarget = {
      instance: this.wrappedChildren[key],
      node: reactNode,
      ghost: document.createElement('div')
    };
    const nativeEvt: DragEvent = evt.nativeEvent;
    const targetNode: HTMLElement = ReactDOM.findDOMNode(draggingTarget.instance) as HTMLElement;
    targetNode.style.display = 'none';
    nativeEvt!.dataTransfer!.setData('node', targetNode.outerHTML);
    nativeEvt!.dataTransfer!.effectAllowed = 'move';
    draggingTarget.ghost.style.display = 'inline-block';
    draggingTarget.ghost.style.width = `${rectTrackerInfo!.width}px`;
    draggingTarget.ghost.style.height = `${rectTrackerInfo!.height}px`;
    draggingTarget.ghost.style.backgroundColor = 'gray';
    draggingTarget.ghost.style.border = 'dashed 1px black';
    this.setState({ draggingTarget });
    onStartDragging && onStartDragging(reactNode);
  };

  handleDraggedOver = (evt: React.SyntheticEvent<Element, DragEvent>): void => {
    evt.preventDefault();
    const { node, instance, ghost } = this.state.draggingTarget!;
    const nativeEvt: DragEvent = evt.nativeEvent;
    const reactInfo = {
      container: this.mainContainer.current as Element,
      node,
      instance
    };
    // remove the ghost node when trying to fit the position
    ghost.parentNode && ghost.parentNode.removeChild(ghost);
    const canDrop = this.layoutHelper.canDrop(reactInfo);
    if (canDrop) {
      nativeEvt!.dataTransfer!.dropEffect = 'move';
      const layoutTarget = {
        container: this.mainContainer.current!,
        target: ghost,
        pageOffset: getChildOffset(this.mainContainer.current!)
      };
      this.layoutHint = this.layoutHelper.layout(
        reactInfo,
        layoutTarget,
        evt.nativeEvent.pageX,
        evt.nativeEvent.pageY
      );
    } else {
      nativeEvt!.dataTransfer!.dropEffect = 'none';
      this.layoutHint = null;
    }
  };

  handleDropped = (evt: React.SyntheticEvent<Element, DragEvent>): void => {
    const { onLayoutChange } = this.props;
    const { draggingTarget } = this.state;
    draggingTarget && onLayoutChange && onLayoutChange(draggingTarget.node, this.layoutHint);
    this.resetDraggingTarget();
    evt.preventDefault();
  };

  getWrappedChildren() {
    this.wrappedChildren = {};
    this.wrappedNodeList = {};
    const { children } = this.props;
    return React.Children.map<any, any>(children, (node: any, index: number) => {
      if (typeof node !== 'object') {
        return node;
      } else {
        const Comp = node.type;
        const mapKey = node.key || `${index}`;
        this.wrappedNodeList[mapKey] = { node, index };
        return <Comp {...node.props} key={node.key} ref={this.bindChildren.bind(this, mapKey)} />;
      }
    });
  }

  renderRectTracker(dndHelper: IDragAndDropHelper = DefaultDnDHelper): React.ReactNode {
    const { draggingTarget, focusedKey, rectTrackerInfo } = this.state;
    if (!focusedKey || !rectTrackerInfo) {
      // no need to display tracker when it has no focus, no info.
      return;
    }
    const { node, index } = this.wrappedNodeList[focusedKey];
    const draggable = dndHelper.isDraggable(node, index);
    // We should hide itself when dragging.
    return (
      <RectTracker
        {...rectTrackerInfo}
        draggable={draggable}
        ref={this.rectTracker}
        visible={!draggingTarget}
        onDragStart={draggable ? this.handleDragStarted.bind(this, node, focusedKey) : undefined}
      />
    );
  }

  render() {
    const { dndHelper, style, onLayoutChange, ...restProps } = this.props;
    const mergedStyle: React.CSSProperties = {
      ...style,
      ...DesignPane.style
    };

    return (
      <section
        {...restProps}
        ref={this.mainContainer}
        style={mergedStyle}
        onMouseDownCapture={this.handleMouseDown}
        onMouseUpCapture={this.handleMouseLeaveUp}
        onMouseLeave={this.handleMouseLeaveUp}
        onDragOver={this.handleDraggedOver}
        onDrop={this.handleDropped}
      >
        {this.getWrappedChildren()}
        {this.renderRectTracker(dndHelper)}
      </section>
    );
  }
}
