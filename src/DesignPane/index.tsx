import * as React from 'react';
import * as ReactDOM from 'react-dom';
import { RectTracker } from './RectTracker';
import { IDragAndDropHelper, DefaultDnDHelper } from './helpers/DragAndDropHelper';
import { ILayoutHelper, FlowLayoutHelper } from './helpers/LayoutHelper';
import { ITraversalHelper, DefaultTraversalHelper } from './helpers/TraversalHelper';
import { Rect, calcPosition, getPageOffset } from './utils';

export interface IDesignPaneProps extends React.ComponentProps<'section'> {
  dndHelper?: IDragAndDropHelper;
  traversalHelper?: ITraversalHelper;

  onLayoutChange?(node: any, container: React.ReactNode | null, layoutHint: any): void;
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

  static defaultProps: IDesignPaneProps = {
    dndHelper: DefaultDnDHelper,
    traversalHelper: DefaultTraversalHelper
  };

  layoutHint: any;
  // refs
  mainContainer: React.RefObject<HTMLElement>;
  rectTracker: React.RefObject<RectTracker>;
  // wrapper info
  childrenMeta: {
    [key: string]: {
      index: number;
      instance?: React.ReactInstance;
      isContainer: boolean;
      layoutHelper: ILayoutHelper | null;
      node: React.ReactNode;
    };
  } = {};

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
    this.childrenMeta[index].instance = ref;
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
    for (let key in this.childrenMeta) {
      const metaInfo = this.childrenMeta[key];
      const wrapper: HTMLElement = ReactDOM.findDOMNode(metaInfo.instance!) as HTMLElement;
      const isTarget = wrapper.contains(evt.nativeEvent.target as Node);
      if (isTarget) {
        targetElement = wrapper;
        targetKey = key;
        if (!metaInfo.isContainer) {
          break;
        }
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

  handleDragStarted = (key: string, evt: React.SyntheticEvent<Element, DragEvent>): void => {
    const { onStartDragging } = this.props;
    const { rectTrackerInfo } = this.state;
    const draggingTarget = {
      instance: this.childrenMeta[key].instance!,
      node: this.childrenMeta[key].node,
      ghost: document.createElement('div')
    };
    const nativeEvt: DragEvent = evt.nativeEvent;
    const targetNode: HTMLElement = ReactDOM.findDOMNode(draggingTarget.instance) as HTMLElement;
    targetNode.style.display = 'none';
    nativeEvt!.dataTransfer!.setData('node', targetNode.outerHTML);
    nativeEvt!.dataTransfer!.effectAllowed = 'move';
    // use gray box as the ghost image.
    // TODO: support HTML freezed ghost image.
    draggingTarget.ghost.style.display = 'inline-block';
    draggingTarget.ghost.style.width = `${rectTrackerInfo!.width}px`;
    draggingTarget.ghost.style.height = `${rectTrackerInfo!.height}px`;
    draggingTarget.ghost.style.backgroundColor = 'gray';
    draggingTarget.ghost.style.border = 'dashed 1px black';
    this.setState({ draggingTarget });
    onStartDragging && onStartDragging(draggingTarget.node);
  };

  handleDraggedOver = (key: string | null, evt: React.SyntheticEvent<Element, DragEvent>): void => {
    evt.preventDefault();
    const { node, instance, ghost } = this.state.draggingTarget!;
    const nativeEvt: DragEvent = evt.nativeEvent;
    const container = key
      ? this.childrenMeta[key].instance!
      : (this.mainContainer.current as Element);
    const layoutHelper = key ? this.childrenMeta[key].layoutHelper! : new FlowLayoutHelper();
    const reactInfo = { container, node, instance };
    // remove the ghost node when trying to fit the position
    ghost.parentNode && ghost.parentNode.removeChild(ghost);
    const canDrop = layoutHelper.canDrop(reactInfo);
    if (canDrop) {
      // we should stop propagation if the inner container can handle this event.
      evt.stopPropagation();
      nativeEvt!.dataTransfer!.dropEffect = 'move';
      const layoutTarget = {
        container: ReactDOM.findDOMNode(reactInfo.container) as HTMLElement,
        target: ghost,
        pageOffset: getPageOffset(
          ReactDOM.findDOMNode(reactInfo.container) as HTMLElement,
          this.mainContainer.current!
        )
      };
      this.layoutHint = layoutHelper.layout(
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

  handleDropped = (key: string | null, evt: React.SyntheticEvent<Element, DragEvent>): void => {
    const { onLayoutChange } = this.props;
    const { draggingTarget } = this.state;
    const container: React.ReactNode | null = key ? this.childrenMeta[key].node : null;
    draggingTarget &&
      onLayoutChange &&
      onLayoutChange(draggingTarget.node, container, this.layoutHint);
    this.resetDraggingTarget();
    evt.preventDefault();
  };

  getWrappedChildren(children: React.ReactNode, parent: string = 'R'): any {
    const { traversalHelper } = this.props;
    const travHelper = traversalHelper || DefaultTraversalHelper;
    return React.Children.map<any, any>(children, (node: any, index: number) => {
      if (typeof node !== 'object') {
        return node;
      } else {
        const Comp = node.type;
        const mapKey = node.key ? `${parent}-${node.key}` : `${parent}-${index}`;
        const isContainer = travHelper.isContainer(node);
        if (isContainer) {
          this.childrenMeta[mapKey] = {
            node,
            index,
            isContainer,
            layoutHelper: travHelper.getLayoutHelper(node)
          };
          return (
            <Comp
              {...node.props}
              key={node.key}
              ref={this.bindChildren.bind(this, mapKey)}
              onDragOver={this.handleDraggedOver.bind(this, mapKey)}
              onDrop={this.handleDropped.bind(this, mapKey)}
            >
              {this.getWrappedChildren(node.props.children, mapKey)}
            </Comp>
          );
        } else {
          this.childrenMeta[mapKey] = {
            node,
            index,
            isContainer,
            layoutHelper: null
          };
          return <Comp {...node.props} key={node.key} ref={this.bindChildren.bind(this, mapKey)} />;
        }
      }
    });
  }

  renderRectTracker(dndHelper: IDragAndDropHelper = DefaultDnDHelper): React.ReactNode {
    const { draggingTarget, focusedKey, rectTrackerInfo } = this.state;
    if (!focusedKey || !rectTrackerInfo) {
      // no need to display tracker when it has no focus, no info.
      return;
    }
    const { node, index } = this.childrenMeta[focusedKey];
    const draggable = dndHelper.isDraggable(node, index);
    // We should hide itself when dragging.
    return (
      <RectTracker
        {...rectTrackerInfo}
        draggable={draggable}
        ref={this.rectTracker}
        visible={!draggingTarget}
        onDragStart={draggable ? this.handleDragStarted.bind(this, focusedKey) : undefined}
      />
    );
  }

  render() {
    const {
      children,
      dndHelper,
      style,
      traversalHelper,
      onLayoutChange,
      ...restProps
    } = this.props;
    const mergedStyle: React.CSSProperties = {
      ...style,
      ...DesignPane.style
    };
    this.childrenMeta = {};
    return (
      <section
        {...restProps}
        ref={this.mainContainer}
        style={mergedStyle}
        onMouseDownCapture={this.handleMouseDown}
        onMouseUpCapture={this.handleMouseLeaveUp}
        onMouseLeave={this.handleMouseLeaveUp}
        onDragOver={this.handleDraggedOver.bind(this, null)}
        onDrop={this.handleDropped.bind(this, null)}
      >
        {this.getWrappedChildren(children)}
        {this.renderRectTracker(dndHelper)}
      </section>
    );
  }
}
