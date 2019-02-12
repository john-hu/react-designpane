import * as React from 'react';
import { ILayoutHelper } from './helpers/LayoutHelper';
import { ITraversalHelper } from './helpers/TraversalHelper';

interface IBuilderOptions {
  cleanBuild?: boolean;
  eventHandlers?: {
    [key: string]: (key: string | null, evt: React.SyntheticEvent<Element, Event>) => void;
  };
}

type ClassType = string | React.FunctionComponent;

// ref https://reactjs.org/docs/react-api.html to implement everything
class HierarchyBuilder {
  controlledChildren: React.ReactChildren | null = null;
  traversalHelper: ITraversalHelper;
  childrenMeta: {
    [key: string]: {
      index: number;
      instance?: React.ReactInstance;
      isContainer: boolean;
      layoutHelper: ILayoutHelper | null;
      node: React.ReactNode;
    };
  } = {};

  constructor(traversalHelper: ITraversalHelper) {
    this.traversalHelper = traversalHelper;
  }

  private bindChildren(key: string, ref: React.ReactInstance): void {
    this.childrenMeta[key].instance = ref;
  }

  private createElement(type: ClassType, props: object, children: React.ReactNode[]): React.ReactNode {
    return React.createElement.apply(React, [ type, props, ...children ]);
  }

  private wireExtra(props: any, key: string, extra?: object): void {
    props.key = key;
    props.ref = this.bindChildren.bind(this, key);
    if (extra) {
      for (let extraKey in extra) {
        props[extraKey] = extra[extraKey];
      }
    }
  }

  private createContainer(mapKey: string, node: any, index: number, option: IBuilderOptions): React.ReactNode {
    this.childrenMeta[mapKey] = {
      node,
      index,
      isContainer: true,
      layoutHelper: this.traversalHelper.getLayoutHelper(node)
    };
    const newProps = { ...node.props };
    // if in cleanBuild, we don't need to put key, ref, and other event listeners
    !option.cleanBuild && this.wireExtra(newProps, mapKey, option.eventHandlers);
    const newChildren = this.getWrappedChildren(option, node.props.children, mapKey);
    return this.createElement(node.type as ClassType, newProps, newChildren);
  }

  private createComponent(mapKey: string, node: any, index: number, option: IBuilderOptions): React.ReactNode {
    this.childrenMeta[mapKey] = {
      node,
      index,
      isContainer: false,
      layoutHelper: null
    };
    const newProps = { ...node.props };
    // if in cleanBuild, we don't need to put key, ref, and other event listeners
    !option.cleanBuild && this.wireExtra(newProps, mapKey, option.eventHandlers);
    const newChildren = this.getWrappedChildren(option, node.props.children, mapKey);
    return this.createElement(node.type as ClassType, newProps, newChildren);
  }

  private getWrappedChildren(
    option: IBuilderOptions,
    children: React.ReactChildren,
    parent: string = 'R'
  ): React.ReactNode[] {
    return React.Children.map<React.ReactNode, any>(children, (node: any, index: number) => {
      if (typeof node !== 'object') {
        // string, nul, or undefined.
        return node;
      } else {
        const mapKey = node.key ? `${parent}-${node.key}` : `${parent}-${index}`;
        const isContainer = this.traversalHelper.isContainer(node);
        if (isContainer) {
          return this.createContainer(mapKey, node, index, option);
        } else {
          return this.createComponent(mapKey, node, index, option);
        }
      }
    });
  }

  load(children: React.ReactChildren): void {
    this.controlledChildren = children;
  }
  renderChildren(option: IBuilderOptions): React.ReactNode[] | null {
    if (!this.controlledChildren) {
      return null;
    }
    return this.getWrappedChildren(option, this.controlledChildren);
  }
  moveTo(node: React.ReactNode, container: React.ReactNode): React.ReactNode[] | null {
    return null;
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
}

export default HierarchyBuilder;
