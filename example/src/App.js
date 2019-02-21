import React, { Component } from 'react';

import { DesignPane } from 'react-designpane';

export default class App extends Component {
  constructor(props) {
    super(props);
    this.state = {
      children: (
        <div>
          <div key="div">
            <span>This is a div</span>
            <strong>ABCD</strong>
          </div>
          <button key="button">This is a button</button>
          <input type="text" key="text" />
          <textarea key="textarea" />
        </div>
      )
    };
  }

  handleLayoutChanged = (children) => {
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
