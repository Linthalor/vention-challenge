import React from 'react';
import './i18n'; // Keep this before any app imports so it is available.
import { createRoot } from 'react-dom/client';
import { Provider } from 'react-redux';
import { store } from './app/store';
import App from './app';
import reportWebVitals from './reportWebVitals';
import './index.scss';
import { IoProvider } from 'socket.io-react-hook';
import { ThemeProvider } from '@mui/material';
import { theme } from './app/theme';

const container = document.getElementById('root')!;
const root = createRoot(container);

root.render(
  <React.StrictMode>
    <ThemeProvider theme={theme}>
      <IoProvider>
        <Provider store={store}>
          <App />
        </Provider>
      </IoProvider>
    </ThemeProvider>
  </React.StrictMode>
);

// If you want to start measuring performance in your app, pass a function
// to log results (for example: reportWebVitals(console.log))
// or send to an analytics endpoint. Learn more: https://bit.ly/CRA-vitals
reportWebVitals();
