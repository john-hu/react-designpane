import * as React from 'react';
import * as ReactDOM from 'react-dom';
import { RectTracker } from './RectTracker';
import { IDragAndDropHelper, DefaultDnDHelper } from './helpers/DragAndDropHelper';
import { FlowLayoutHelper } from './helpers/LayoutHelper';
import { ITraversalHelper, DefaultTraversalHelper } from './helpers/TraversalHelper';
import { HierarchyBuilder } from './HierarchyBuilder';
import { Rect, calcPosition, getPageOffset } from './utils';

export interface IDesignPaneProps extends React.ComponentProps<'section'> {
  dndHelper?: IDragAndDropHelper;
  hierarchyBuilder?: HierarchyBuilder;
  traversalHelper?: ITraversalHelper;

  onLayoutChange?(children: React.ReactNode[]): void;
  onStartDragging?(node: any): void;
  // Since we will remove the onDrop, onDragOver of root container, the children should be only one
  // ReactNode which should be a container.
}

interface IDesignPaneState {
  draggingTarget: {
    key: string;
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
    hierarchyBuilder: new HierarchyBuilder(DefaultTraversalHelper),
    traversalHelper: DefaultTraversalHelper
  };

  layoutHint: any;
  // refs
  mainContainer: React.RefObject<HTMLElement>;
  rectTracker: React.RefObject<RectTracker>;

  constructor(props: IDesignPaneProps) {
    super(props);
    this.state = {
      draggingTarget: null,
      focusedKey: null,
      rectTrackerInfo: null
    };
    this.mainContainer = React.createRef();
    this.rectTracker = React.createRef();
    props.hierarchyBuilder!.load(props.children);
  }

  componentWillReceiveProps(nextProps: IDesignPaneProps) {
    const { children, hierarchyBuilder } = this.props;
    if (nextProps.children !== children) {
      hierarchyBuilder!.load(nextProps.children);
    }
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
    const { hierarchyBuilder } = this.props;
    let targetElement: HTMLElement | null = null;
    let targetKey: string | null = null;
    // iterate all children to check which one contains the event target.
    const keys = hierarchyBuilder!.getKeys();
    // TODO: We should change the implementation to leverage layout manager to detect which
    // component is under the cursor.
    for (let idx in keys) {
      const instance: React.ReactInstance = hierarchyBuilder!.getReactInstance(keys[idx])!;
      const wrapper: HTMLElement = ReactDOM.findDOMNode(instance) as HTMLElement;
      const isTarget = wrapper.contains(evt.nativeEvent.target as Node);
      if (isTarget) {
        targetElement = wrapper;
        targetKey = keys[idx];
        if (!hierarchyBuilder!.isContainer(keys[idx])) {
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
    const { hierarchyBuilder, onStartDragging } = this.props;
    const { rectTrackerInfo } = this.state;
    const draggingTarget = {
      key: key,
      instance: hierarchyBuilder!.getReactInstance(key)!,
      node: hierarchyBuilder!.getReactNode(key)!,
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
    const { hierarchyBuilder } = this.props;
    const { node, instance, ghost } = this.state.draggingTarget!;
    const nativeEvt: DragEvent = evt.nativeEvent;
    const container = key
      ? hierarchyBuilder!.getReactInstance(key)!
      : (this.mainContainer.current as Element);
    const layoutHelper = key ? hierarchyBuilder!.getLayoutHelper(key)! : new FlowLayoutHelper();
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
    const { hierarchyBuilder, onLayoutChange } = this.props;
    const { draggingTarget } = this.state;
    if (!key || !draggingTarget) {
      return;
    }
    const newChildren = hierarchyBuilder!.moveTo(draggingTarget.key, key, this.layoutHint);
    newChildren && onLayoutChange && onLayoutChange(newChildren);
    this.resetDraggingTarget();
    evt.preventDefault();
    evt.stopPropagation();
  };

  getWrappedChildren(): any {
    return this.props.hierarchyBuilder!.renderChildren({
      containerEventHandlers: {
        onDragOver: this.handleDraggedOver,
        onDrop: this.handleDropped
      }
    });
  }

  renderRectTracker(dndHelper: IDragAndDropHelper = DefaultDnDHelper): React.ReactNode {
    const { draggingTarget, focusedKey, rectTrackerInfo } = this.state;
    if (!focusedKey || !rectTrackerInfo) {
      // no need to display tracker when it has no focus, no info.
      return;
    }
    const { hierarchyBuilder } = this.props;
    const node = hierarchyBuilder!.getReactNode(focusedKey);
    const index = hierarchyBuilder!.getNodeIndex(focusedKey);
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
    return (
      <section
        {...restProps}
        ref={this.mainContainer}
        style={mergedStyle}
        onMouseDownCapture={this.handleMouseDown}
        onMouseUpCapture={this.handleMouseLeaveUp}
        onMouseLeave={this.handleMouseLeaveUp}
      >
        {this.getWrappedChildren()}
        {this.renderRectTracker(dndHelper)}
      </section>
    );
  }
}
