import * as React from 'react';
import { ILayoutHelper } from './helpers/LayoutHelper';
import { ITraversalHelper } from './helpers/TraversalHelper';

enum ActionType {
  /** move a component from one container to another one */
  MOVE,
  /** create a component and append to a container*/
  CREATE,
  /** delete a component from a container */
  DELETE
}

export interface IBuilderOptions {
  /** do we need to wire event listeners and ref and key to the created ReactNodes. */
  cleanBuild?: boolean;
  componentEventHandlers?: {
    [key: string]: (key: string | null, evt: React.SyntheticEvent<Element, any>) => void;
  };
  containerEventHandlers?: {
    [key: string]: (key: string | null, evt: React.SyntheticEvent<Element, any>) => void;
  };
}
/** The data sturcture of BuilderActions.type === MOVE */
type ActionMove = {
  type: ActionType;
  component: string;
  toContainer: string;
  beforeIndex: number;
};

type BuilderActions = ActionMove | null;

type ClassType = string | React.FunctionComponent;

// ref https://reactjs.org/docs/react-api.html to implement everything
export class HierarchyBuilder {
  controlledChildren: React.ReactNode | null = null;
  traversalHelper: ITraversalHelper;
  childrenMeta: {
    [key: string]: {
      index: number;
      instance?: React.ReactInstance;
      isContainer: boolean;
      layoutHelper: ILayoutHelper | null;
      node: React.ReactNode;
      ancestors: string[];
    };
  } = {};

  constructor(traversalHelper: ITraversalHelper) {
    this.traversalHelper = traversalHelper;
  }

  private bindChildren(key: string, ref: React.ReactInstance): void {
    // We will use ref to bind all children under design pane and keep its
    // instance. When unmounting, react may give us null. We should check if
    // the cache is already flushed by next rendering.
    if (this.childrenMeta[key]) {
      this.childrenMeta[key].instance = ref;
    }
  }

  private createElement(
    type: ClassType,
    props: object,
    children: React.ReactNode[]
  ): React.ReactNode {
    // TODO: the key may be changed by react. we should consider if we need to use this way.
    return React.createElement.apply(React, [type, props, ...children]);
  }

  private wireExtra(props: any, key: string, extra?: object): void {
    props.key = key;
    props.ref = this.bindChildren.bind(this, key);
    if (extra) {
      for (let extraKey in extra) {
        props[extraKey] = extra[extraKey].bind(null, key);
      }
    }
  }

  private createChildrenBasedOnMoveAction(
    ancestors: string[],
    mapKey: string,
    node: any,
    option: IBuilderOptions,
    extraActions: BuilderActions
  ): React.ReactNode[] {
    const compMeta = this.childrenMeta[extraActions!.component];
    const toSelf: boolean = extraActions!.toContainer === mapKey;
    const fromSelf: boolean = compMeta.ancestors[compMeta.ancestors.length - 1] === mapKey;
    if (toSelf && fromSelf) {
      // reorder
      const newChildren = [...node.props.children];
      newChildren.splice(newChildren.indexOf(compMeta.node), 1);
      newChildren.splice(extraActions!.beforeIndex, 0, compMeta.node);
      return this.createChildren(option, newChildren, [...ancestors, mapKey], extraActions);
    } else if (toSelf) {
      // move child to here.
      const newChildren = [...node.props.children];
      newChildren.splice(extraActions!.beforeIndex, 0, compMeta.node);
      return this.createChildren(option, newChildren, [...ancestors, mapKey], extraActions);
    } else if (fromSelf) {
      // move child from here.
      const newChildren = [...node.props.children];
      newChildren.splice(newChildren.indexOf(compMeta.node), 1);
      return this.createChildren(option, newChildren, [...ancestors, mapKey], extraActions);
    } else {
      // not me, do nothing.
      return this.createChildren(option, node.props.children, [...ancestors, mapKey], extraActions);
    }
  }

  private createContainer(
    ancestors: string[],
    mapKey: string,
    node: any,
    index: number,
    option: IBuilderOptions,
    extraActions: BuilderActions
  ): React.ReactNode {
    const newProps = { ...node.props };
    if (!option.cleanBuild) {
      this.childrenMeta[mapKey] = {
        node,
        index,
        isContainer: true,
        layoutHelper: this.traversalHelper.getLayoutHelper(node),
        ancestors
      };
      // if in cleanBuild, we don't need to put key, ref, and other event listeners
      this.wireExtra(newProps, mapKey, option.containerEventHandlers);
    }
    let newChildren: React.ReactNode[];
    if (extraActions && extraActions.type === ActionType.MOVE) {
      newChildren = this.createChildrenBasedOnMoveAction(
        ancestors,
        mapKey,
        node,
        option,
        extraActions
      );
    } else {
      newChildren = this.createChildren(
        option,
        node.props.children,
        [...ancestors, mapKey],
        extraActions
      );
    }
    return this.createElement(node.type as ClassType, newProps, newChildren);
  }

  private createComponent(
    ancestors: string[],
    mapKey: string,
    node: any,
    index: number,
    option: IBuilderOptions,
    _extraActions: BuilderActions
  ): React.ReactNode {
    const newProps = { ...node.props };
    if (!option.cleanBuild) {
      this.childrenMeta[mapKey] = {
        node,
        index,
        isContainer: false,
        layoutHelper: null,
        ancestors
      };
      // if in cleanBuild, we don't need to put key, ref, and other event listeners
      this.wireExtra(newProps, mapKey, option.componentEventHandlers);
    }
    return this.createElement(node.type as ClassType, newProps, node.props.children);
  }

  private createChildren(
    option: IBuilderOptions,
    children: React.ReactNode | any[],
    ancestors: string[] = ['R'],
    extraActions: BuilderActions = null
  ): React.ReactNode[] {
    return React.Children.map<React.ReactNode, any>(children, (node: any, index: number) => {
      if (typeof node !== 'object') {
        // string, nul, or undefined.
        return node;
      } else {
        const parent = ancestors[ancestors.length - 1];
        const mapKey = node.key ? `${parent}-${node.key}` : `${parent}-${index}`;
        const isContainer = this.traversalHelper.isContainer(node);
        if (isContainer) {
          return this.createContainer(ancestors, mapKey, node, index, option, extraActions);
        } else {
          return this.createComponent(ancestors, mapKey, node, index, option, extraActions);
        }
      }
    });
  }

  load(children: React.ReactNode | null): void {
    this.controlledChildren = children;
  }
  /**
   * This method will flush the childrenMeta cache if it is not cleanBuild.
   * @param option BuilderOptions
   */
  renderChildren(option: IBuilderOptions): React.ReactNode[] | null {
    if (!this.controlledChildren) {
      return null;
    }
    if (!option.cleanBuild) {
      // if not cleanBuild, we need to rebuild cache.
      this.childrenMeta = {};
    }
    return this.createChildren(option, this.controlledChildren);
  }

  /**
   *
   * @param component the moving component key
   * @param toContainer the move to container key
   * @param beforeIndex the position information
   * @returns the ReactNodes built from clean build.
   */
  moveTo(component: string, toContainer: string, beforeIndex: number): React.ReactNode[] | null {
    if (!this.controlledChildren) {
      return null;
    }
    const movement: BuilderActions = { type: ActionType.MOVE, component, toContainer, beforeIndex };
    return this.createChildren({ cleanBuild: true }, this.controlledChildren, ['R'], movement);
  }
  getReactInstance(key: string): React.ReactInstance | null {
    if (this.childrenMeta[key] && this.childrenMeta[key].instance) {
      return this.childrenMeta[key].instance!;
    } else {
      return null;
    }
  }
  getReactNode(key: string): React.ReactNode | null {
    return this.childrenMeta[key] ? this.childrenMeta[key].node : null;
  }
  isContainer(key: string): boolean {
    return this.childrenMeta[key] ? this.childrenMeta[key].isContainer : false;
  }
  getLayoutHelper(key: string): ILayoutHelper | null {
    return this.childrenMeta[key] ? this.childrenMeta[key].layoutHelper : null;
  }
  getNodeIndex(key: string): number {
    return this.childrenMeta[key] ? this.childrenMeta[key].index : -1;
  }
  getKeys(): string[] {
    return Object.keys(this.childrenMeta);
  }
}
