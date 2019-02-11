import * as React from 'react';
import { ILayoutHelper, FlowLayoutHelper } from './LayoutHelper';

export interface ITraversalHelper {
  /** Return true if a react node is a container, like div, section. */
  isContainer(node: React.ReactNode): boolean;
  /** Return a layout helper if a react node is a container. */
  getLayoutHelper(node: React.ReactNode): ILayoutHelper | null;
}

const containerElements: Array<string> = ['div', 'section', 'article'];
export const DefaultTraversalHelper: ITraversalHelper = {
  isContainer(node: React.ReactNode): boolean {
    if (!node) {
      return false;
    } else if (typeof (node as React.ReactElement<any>).type === 'string') {
      const typeName:string = (node as React.ReactElement<any>).type as string;
      return containerElements.indexOf(typeName) > -1;
    } else {
      return false;
    }
  },

  getLayoutHelper(node: React.ReactNode): ILayoutHelper | null {
    if (this.isContainer(node)) {
      return new FlowLayoutHelper();
    } else {
      return null;
    }
  }
};
