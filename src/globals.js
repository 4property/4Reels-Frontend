// Bridges npm React/ReactDOM to the window globals the existing
// CDN-style component files (Icon.jsx, App.jsx, etc.) expect.
import React from 'react';
import * as ReactDOMClient from 'react-dom/client';

window.React = React;
window.ReactDOM = ReactDOMClient;
