import { createTheme } from '@mui/material';

// Themed using Upgrade's palette
export const theme = createTheme({
  palette: {
    primary: {
      light: '#197ce0',
      main: '#1c344f',
      // dark: '#008051',
      contrastText: '#ffffff',
    },
    secondary: {
      main: '#1bc876',
      // light: '#f5fffa',
    },
    success: {
      light: '#f5fffa',
      main: '#1bc876',
      contrastText: '#ffffff',
    },
    error: {
      // light: '#eec3c8',
      main: '#fd1221',
      contrastText: '#ffffff',
    },
    text: {
      primary: '#1c344f',
      secondary: '#1bc876'
    },
    background: {
      // default: '#f3f5f9',
      paper: '#f3f5f9',
    }
  },
});