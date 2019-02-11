import React, { Component } from 'react';

import { DesignPane } from 'react-designpane';

export default class App extends Component {
  constructor(props) {
    super(props);
    this.state = {
      children: [
        <div key='div'>
          <span>This is a div</span>
          <strong>ABCD</strong>
        </div>,
        <button key='button'>This is a button</button>,
        <input type='text' key='text' />,
        <textarea key='textarea' />
      ]
    };
  }

  handleLayoutChanged = (node, container, layoutHint) => {
    if (!container) {
      const children = [...this.state.children];
      children.splice(children.indexOf(node), 1);
      children.splice(layoutHint, 0, node);
      this.setState({ children });
    } else {
      // TODO: implement this correctly. We should find a good way to modal the component tree
      // test cases:
      //   *. move a node from a container to another container
      //   *. move a node from root to another container
      //   *. move a node from a container to root.
      //   *. move a container from a container to another container (should be the same as the first one)
    }
  };

  render() {
    return (
      <div>
        <DesignPane className='design-pane' onLayoutChange={this.handleLayoutChanged}>
          {this.state.children}
        </DesignPane>
      </div>
    );
  }
}
