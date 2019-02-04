import React, { Component } from 'react';

import DesignPane from 'react-designpane';

export default class App extends Component {
  constructor(props) {
    super(props);
    this.state = {
      children: [
        <div key="div">This is a div</div>,
        <button key="button">This is a button</button>,
        <input type="text" key="text" />,
        <textarea  key="textarea" />
      ]
    };
  }

  handleLayoutChanged = (node, layoutHint) => {
    const children = [...this.state.children];
    children.splice(children.indexOf(node), 1);
    children.splice(layoutHint, 0, node);
    this.setState({ children });
  };

  render() {
    return (
      <div>
        <DesignPane className="design-pane" onLayoutChange={this.handleLayoutChanged}>
          {this.state.children}
        </DesignPane>
      </div>
    );
  }
}
