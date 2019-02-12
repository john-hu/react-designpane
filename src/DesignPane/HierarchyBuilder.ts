import { ReactChildren, ReactInstance, ReactNode, SyntheticEvent } from 'react';
import { ILayoutHelper } from './helpers/LayoutHelper';

interface IBuilderOptions {
  cleanBuild?: boolean;
  eventHandlers?: {
    [key: string]: (key: string|null, evt: SyntheticEvent<Element, Event>) => void
  };
}
// ref https://reactjs.org/docs/react-api.html to implement everything
class HierarchyBuilder {
  load(children: ReactChildren):void {}
  buildChildren(option: IBuilderOptions):void {}
  moveTo(node: ReactNode, container: ReactNode): ReactChildren|null { return null; }
  getReactInstance(key: string): ReactInstance|null { return null; }
  getReactNode(key: string): ReactNode|null { return null; }
  isContainer(key: string): boolean { return false; }
  getLayoutHelper(key: string): ILayoutHelper|null { return null; }
}

export default HierarchyBuilder;
