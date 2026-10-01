import React from 'react';
import ReactDOM from 'react-dom/client';
import { FoundationApp } from './FoundationApp';
import { LocaleProvider } from '@conecta/i18n';
import '@conecta/ui/styles.css';

ReactDOM.createRoot(document.getElementById('root')!).render(<React.StrictMode><LocaleProvider><FoundationApp /></LocaleProvider></React.StrictMode>);
